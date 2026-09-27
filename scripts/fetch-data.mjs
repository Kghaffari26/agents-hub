#!/usr/bin/env node
/**
 * Assemble public/data/ from each agent's `data` branch.
 *
 *   node scripts/fetch-data.mjs            # live fetch, per-agent fallback to fixtures
 *   node scripts/fetch-data.mjs --offline  # fixtures only (no network)
 *
 * Also, from each agent repo's default branch (not its data branch): evals/history.jsonl →
 * public/data/evals/<id>.json (normalized; agents-mcp too) and docs/case-studies.md →
 * public/data/case-studies/<id>.md, each falling back to test/fixtures/{evals,case-studies}/.
 *
 * For every agent in config/sources.json:
 *   1. Download its files from https://raw.githubusercontent.com/<repo>/<branch>/<path>
 *      (latest.json, manifest-entry.json, costs-summary.json, agent-specific files,
 *      schema.json when present, and the most recent history/ snapshots).
 *   2. Validate them against the site's zod contracts (src/lib/schemas).
 *   3. If the branch is missing, any required fetch fails, or validation fails, copy
 *      test/fixtures/<agent>/ instead and mark the agent `sample: true`.
 * Then write public/data/manifest.json (overview-card order = config order) and
 * public/data/costs/summary.json.
 *
 * Every fallback records exactly why, as `{ kind, file, message, issues }` in
 * public/data/_fetch-report.json, one log line per agent, and a summary table at the end
 * (also appended to $GITHUB_STEP_SUMMARY on Actions). Kinds:
 *   missing_repo · missing_branch · missing_file · http · network · invalid_json · validation · offline
 *
 * This script never exits non-zero because an agent hasn't published yet.
 */
import { cp, mkdir, readFile, rm, writeFile, readdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { agenticWarnings, loadSchemas, validateJson } from './lib/contracts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.FETCH_OUT_DIR
  ? path.resolve(process.env.FETCH_OUT_DIR)
  : path.join(ROOT, 'public', 'data');
const FIXTURES = path.join(ROOT, 'test', 'fixtures');
const OFFLINE = process.argv.includes('--offline') || process.env.FETCH_OFFLINE === '1';
const HISTORY_KEEP = Number(process.env.FETCH_HISTORY_KEEP ?? 7);
const TIMEOUT_MS = 20_000;
/**
 * `--local <agent>=<dir>` (repeatable): read that agent's data branch from a local directory
 * (e.g. an agent repo's public-data/) instead of GitHub, with the same validation. For checking
 * a real agent run against the site before it's published.
 */
const LOCAL = Object.fromEntries(
  process.argv
    .flatMap((a, i, all) => (a === '--local' ? [all[i + 1]] : a.startsWith('--local=') ? [a.slice(8)] : []))
    .filter(Boolean)
    .map((x) => {
      const [id, ...dir] = x.split('=');
      return [id, path.resolve(dir.join('='))];
    }),
);

/**
 * `--local-repo <id>=<dir>` (repeatable): read an agent repo's default-branch files (evals history,
 * case studies) from a local checkout instead of raw.githubusercontent.com.
 */
const LOCAL_REPO = Object.fromEntries(
  process.argv
    .flatMap((a, i, all) =>
      a === '--local-repo' ? [all[i + 1]] : a.startsWith('--local-repo=') ? [a.slice(13)] : [],
    )
    .filter(Boolean)
    .map((x) => {
      const [id, ...dir] = x.split('=');
      return [id, path.resolve(dir.join('='))];
    }),
);
const MAX_MD_BYTES = 300_000;
const MAX_EVAL_ENTRIES = 400;

const config = JSON.parse(await readFile(path.join(ROOT, 'config', 'sources.json'), 'utf8'));
const schemas = await loadSchemas();
const execFileP = promisify(execFile);

const log = (...a) => console.log('[fetch-data]', ...a);

async function fetchWithTimeout(url, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Why an agent fell back to sample data. Thrown by fetchAgent, recorded in the fetch report. */
class Fallback extends Error {
  constructor(kind, message, { file = null, status = null, issues = [] } = {}) {
    super(message);
    this.kind = kind;
    this.file = file;
    this.status = status;
    this.issues = issues;
  }
}

async function fetchText(url, file) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.status === 404)
        throw new Fallback('missing_file', `${file}: 404 Not Found`, { file, status: 404 });
      if (!res.ok) {
        const err = new Fallback('http', `${file}: HTTP ${res.status} ${res.statusText}`.trim(), {
          file,
          status: res.status,
        });
        if (res.status < 500 && res.status !== 429) throw err; // not worth retrying
        lastErr = err;
      } else {
        return await res.text();
      }
    } catch (e) {
      if (e instanceof Fallback && e.status && e.status < 500 && e.status !== 429) throw e;
      lastErr =
        e instanceof Fallback
          ? e
          : new Fallback(
              'network',
              `${file}: ${e.name === 'AbortError' ? `timed out after ${TIMEOUT_MS / 1000}s` : (e.cause?.code ?? e.message)}`,
              { file },
            );
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw lastErr;
}

/**
 * latest.json 404'd: tell a missing repo from a missing `data` branch from a missing file.
 * Uses `git ls-remote` (no API rate limit, works without a token for public repos); if git
 * itself fails for another reason, keep the plain 404.
 */
async function explainNotFound(agent, err) {
  const url = `https://github.com/${agent.repo}.git`;
  try {
    const { stdout } = await execFileP('git', ['ls-remote', '--heads', url, agent.branch], {
      timeout: TIMEOUT_MS,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    if (stdout.trim())
      return new Fallback('missing_file', `branch "${agent.branch}" exists but has no ${err.file}`, {
        file: err.file,
        status: 404,
      });
    return new Fallback(
      'missing_branch',
      `${agent.repo} has no "${agent.branch}" branch yet (agent hasn't published)`,
      {
        status: 404,
      },
    );
  } catch (e) {
    const out = `${e.stderr ?? ''}`;
    if (/not found|could not read Username|Authentication failed/i.test(out))
      return new Fallback('missing_repo', `repo ${agent.repo} not found (or private)`, { status: 404 });
    return err;
  }
}

function parseAndValidate(agentId, rel, text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Fallback('invalid_json', `${rel}: invalid JSON (${e.message})`, { file: rel });
  }
  const issues = validateJson(schemas, agentId, rel, data);
  if (issues.length) {
    const first = issues[0];
    throw new Fallback(
      'validation',
      `${rel} failed validation at ${first.path || '(root)'}: ${first.message}` +
        (issues.length > 1 ? ` (+${issues.length - 1} more)` : ''),
      { file: rel, issues },
    );
  }
  return data;
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

async function listHistory(agent) {
  // raw.githubusercontent.com can't list directories; use the contents API (best effort).
  const url = `https://api.github.com/repos/${agent.repo}/contents/history?ref=${agent.branch}`;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'agents-hub-fetch-data' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetchWithTimeout(url, { headers });
    if (!res.ok) return [];
    const items = await res.json();
    return items
      .map((x) => x.name)
      .filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n))
      .sort()
      .slice(-HISTORY_KEEP);
  } catch {
    return [];
  }
}

async function readLocal(dir, rel) {
  try {
    return await readFile(path.join(dir, rel), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT')
      throw new Fallback('missing_file', `${rel}: not found in ${dir}`, { file: rel, status: 404 });
    throw e;
  }
}

async function listLocalHistory(dir) {
  try {
    return (await readdir(path.join(dir, 'history')))
      .filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n))
      .sort()
      .slice(-HISTORY_KEEP);
  } catch {
    return [];
  }
}

async function fetchAgent(agent, dest) {
  const base = `${config.raw_base}/${agent.repo}/${agent.branch}`;
  const localDir = LOCAL[agent.id];
  const files = new Map();
  const warnings = [];
  const get = async (rel, { optional = false } = {}) => {
    try {
      const text = localDir ? await readLocal(localDir, rel) : await fetchText(`${base}/${rel}`, rel);
      const data = parseAndValidate(agent.id, rel, text);
      files.set(rel, text);
      if (!rel.startsWith('history/')) warnings.push(...agenticWarnings(schemas, agent.id, rel, data));
      return data;
    } catch (e) {
      if (!optional) throw e;
      // Optional files (schema.json, trace.json, history snapshots) never cause a fallback, but say why they were skipped.
      if (e.kind === 'missing_file' && rel === 'trace.json')
        warnings.push(
          'no trace.json yet (published from agents-core v0.3.0 on); the Run trace panel says so',
        );
      else if (!(e.kind === 'missing_file' && rel === 'schema.json')) warnings.push(`skipped ${e.message}`);
      return null;
    }
  };
  let latest;
  try {
    latest = await get('latest.json');
  } catch (e) {
    throw e.kind === 'missing_file' && !localDir ? await explainNotFound(agent, e) : e;
  }
  const optional = new Set(agent.optional_files ?? []);
  for (const rel of agent.files) {
    if (rel === 'latest.json') continue;
    await get(rel, { optional: optional.has(rel) });
  }
  if (agent.dynamic_files) {
    // e.g. metros[*].slug → metros/{}.json
    const [arrKey, field] = agent.dynamic_files.jsonpath.split('[*].');
    const keys = (latest[arrKey] ?? []).map((x) => x[field]);
    await pool(keys, 8, (k) => get(agent.dynamic_files.pattern.replace('{}', k)));
  }
  const history = localDir ? await listLocalHistory(localDir) : await listHistory(agent);
  await pool(history, 4, (n) => get(`history/${n}`, { optional: true }));

  for (const [rel, text] of files) {
    const p = path.join(dest, rel);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, text);
  }
  return { fileCount: files.size, warnings, schemaVersion: latest.meta?.schema_version ?? null };
}

async function copyFixtures(agentId, dest) {
  const src = path.join(FIXTURES, agentId);
  if (!existsSync(src)) throw new Error(`no fixtures for ${agentId} at ${src}`);
  await cp(src, dest, { recursive: true });
}

async function readJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const report = [];
  for (const agent of config.agents) {
    const dest = path.join(OUT, agent.id);
    const tmp = `${dest}.tmp`;
    await rm(tmp, { recursive: true, force: true });
    await mkdir(tmp, { recursive: true });
    let sample = false;
    let reason = null;
    let result = null;
    if (OFFLINE && !LOCAL[agent.id]) {
      sample = true;
      reason = {
        kind: 'offline',
        file: null,
        message: 'offline mode (--offline / FETCH_OFFLINE=1)',
        issues: [],
      };
    } else {
      try {
        result = await fetchAgent(agent, tmp);
        log(
          `${agent.id}: LIVE — ${result.fileCount} files from ${agent.repo}@${agent.branch} (schema ${result.schemaVersion})`,
        );
        for (const w of result.warnings) log(`${agent.id}:   warning: ${w}`);
      } catch (e) {
        sample = true;
        reason =
          e instanceof Fallback
            ? { kind: e.kind, file: e.file, message: e.message, issues: e.issues.slice(0, 20) }
            : { kind: 'error', file: null, message: String(e?.message ?? e), issues: [] };
      }
    }
    if (sample) {
      await rm(tmp, { recursive: true, force: true });
      await copyFixtures(agent.id, tmp);
      log(`${agent.id}: SAMPLE DATA — ${reason.kind}: ${reason.message}`);
      for (const i of reason.issues.slice(0, 10))
        log(`${agent.id}:   at ${i.path || '(root)'}: ${i.message}`);
      if (reason.issues.length > 10)
        log(`${agent.id}:   … ${reason.issues.length - 10} more issues in _fetch-report.json`);
    }
    await rm(dest, { recursive: true, force: true });
    await rename(tmp, dest);
    report.push({
      id: agent.id,
      repo: agent.repo,
      branch: agent.branch,
      sample,
      files: result?.fileCount ?? null,
      schema_version: result?.schemaVersion ?? null,
      warnings: result?.warnings ?? [],
      reason,
    });
  }

  // manifest.json — overview-card order follows config order.
  const agents = [];
  const costs = [];
  for (const [i, agent] of config.agents.entries()) {
    const dir = path.join(OUT, agent.id);
    const entry = await readJson(path.join(dir, 'manifest-entry.json'));
    agents.push({ ...entry, route: agent.route, sample: report[i].sample, repo: agent.repo });
    const c = existsSync(path.join(dir, 'costs-summary.json'))
      ? await readJson(path.join(dir, 'costs-summary.json'))
      : null;
    costs.push({ agent: agent.id, summary: c, sample: report[i].sample });
  }
  const manifest = { generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), agents };
  schemas.manifest.parse(manifest);
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));

  // costs/summary.json — aggregate the current month across agents.
  const months = costs
    .map((c) => c.summary?.month)
    .filter(Boolean)
    .sort();
  const month = months.at(-1) ?? new Date().toISOString().slice(0, 7);
  const daily = new Map();
  let total = 0;
  let allTime = 0;
  const byAgent = [];
  const avg = [];
  for (const c of costs) {
    const s = c.summary;
    if (!s) continue;
    allTime += s.all_time_usd;
    const inMonth = s.month === month;
    const usd = inMonth ? s.total_usd : 0;
    const runs = inMonth ? s.runs : 0;
    total += usd;
    byAgent.push({ agent: c.agent, usd: round4(usd), runs });
    avg.push({ agent: c.agent, usd: runs ? round4(usd / runs) : 0 });
    if (inMonth) for (const d of s.daily) daily.set(d.date, (daily.get(d.date) ?? 0) + d.usd);
  }
  const summary = {
    month,
    total_usd: round4(total),
    by_agent: byAgent,
    daily: [...daily.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, usd]) => ({ date, usd: round4(usd) })),
    all_time_usd: round4(allTime),
    avg_cost_per_run: avg,
    sample_agents: costs.filter((c) => c.sample).map((c) => c.agent),
  };
  schemas.costSummary.parse(summary);
  await mkdir(path.join(OUT, 'costs'), { recursive: true });
  await writeFile(path.join(OUT, 'costs', 'summary.json'), JSON.stringify(summary));
  const extras = await fetchRepoFiles(manifest.generated_at);
  await writeFile(
    path.join(OUT, '_fetch-report.json'),
    JSON.stringify(
      { generated_at: manifest.generated_at, offline: OFFLINE, agents: report, extras },
      null,
      2,
    ),
  );
  await printSummary(report);
  await printExtras(extras);
  const list = await readdir(OUT);
  log(`public/data: ${list.join(', ')}`);
}

/** Per-agent table in the build log (and the Actions job summary when available). */
async function printSummary(report) {
  const rows = report.map((r) => [
    r.id,
    r.sample ? 'SAMPLE' : 'live',
    r.sample ? '—' : String(r.files),
    r.sample ? r.reason.kind : (r.schema_version ?? '—'),
    r.sample ? r.reason.message : r.warnings.length ? `${r.warnings.length} warning(s)` : 'ok',
  ]);
  const head = ['agent', 'data', 'files', 'schema / reason', 'detail'];
  const widths = head.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => Math.min(r[i].length, i === 4 ? 200 : 40))),
  );
  const line = (cells) =>
    cells
      .map((c, i) => c.padEnd(widths[i]))
      .join('  ')
      .trimEnd();
  const live = report.filter((r) => !r.sample).length;
  console.log('');
  log(`summary: ${live}/${report.length} agents live, ${report.length - live} using sample data`);
  console.log('  ' + line(head));
  console.log('  ' + widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log('  ' + line(r));
  console.log('');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const esc = (x) => x.replace(/\|/g, '\\|');
    const md = [
      `### Agent data: ${live}/${report.length} live`,
      '',
      `| ${head.join(' | ')} |`,
      `| ${head.map(() => '---').join(' | ')} |`,
      ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
      '',
    ].join('\n');
    await appendFile(process.env.GITHUB_STEP_SUMMARY, md).catch(() => {});
  }
}

// ---- default-branch files: evals history and case studies ---------------------------------

/** Read `rel` from a repo's default branch (or a `--local-repo` checkout). Throws a Fallback. */
async function readRepoFile(id, repo, rel) {
  const local = LOCAL_REPO[id];
  if (local) return readLocal(local, rel);
  if (OFFLINE) throw new Fallback('offline', 'offline mode (--offline / FETCH_OFFLINE=1)');
  return fetchText(`${config.raw_base}/${repo}/${config.repo_files.branch}/${rel}`, rel);
}

/** Parse JSONL eval history: valid lines are normalized, invalid ones counted and skipped. */
function parseEvalHistory(text) {
  const entries = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let raw;
    try {
      raw = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }
    const res = schemas.evalHistoryLine.safeParse(raw);
    if (res.success) entries.push(res.data);
    else skipped++;
  }
  entries.sort((a, b) => a.ts.localeCompare(b.ts));
  return { entries: entries.slice(-MAX_EVAL_ENTRIES), skipped };
}

async function fetchRepoFiles(generatedAt) {
  const rf = config.repo_files;
  const out = { evals: [], case_studies: [] };
  const evalSources = [
    ...config.agents.map((a) => ({ id: a.id, name: a.name, repo: a.repo })),
    ...(config.eval_sources ?? []),
  ];
  await mkdir(path.join(OUT, 'evals'), { recursive: true });
  for (const src of evalSources) {
    const source_url = `https://github.com/${src.repo}/blob/${rf.branch}/${rf.evals}`;
    let parsed = null;
    let reason = null;
    try {
      parsed = parseEvalHistory(await readRepoFile(src.id, src.repo, rf.evals));
      if (!parsed.entries.length) {
        reason = `${rf.evals}: no valid entries${parsed.skipped ? ` (${parsed.skipped} invalid lines)` : ''}`;
        parsed = null;
      }
    } catch (e) {
      reason = e instanceof Fallback ? `${e.kind}: ${e.message}` : String(e?.message ?? e);
    }
    let sample = false;
    if (!parsed) {
      sample = true;
      parsed = parseEvalHistory(await readFile(path.join(FIXTURES, 'evals', `${src.id}.jsonl`), 'utf8'));
    }
    // Harnesses that don't write `suite` (agents-mcp's) get a configured name instead of "default".
    if (src.default_suite)
      for (const e of parsed.entries) if (e.suite === 'default') e.suite = src.default_suite;
    const file = {
      id: src.id,
      name: src.name,
      repo: src.repo,
      source_url,
      sample,
      reason,
      skipped_lines: parsed.skipped,
      entries: parsed.entries,
    };
    schemas.evalsData.parse(file);
    await writeFile(path.join(OUT, 'evals', `${src.id}.json`), JSON.stringify(file));
    out.evals.push({
      id: src.id,
      sample,
      reason,
      entries: parsed.entries.length,
      skipped_lines: parsed.skipped,
    });
    log(
      `evals/${src.id}: ${sample ? `SAMPLE — ${reason}` : `live — ${parsed.entries.length} entries`}${
        parsed.skipped ? ` (${parsed.skipped} invalid lines skipped)` : ''
      }`,
    );
  }

  await mkdir(path.join(OUT, 'case-studies'), { recursive: true });
  const items = [];
  for (const a of config.agents) {
    const source_url = `https://github.com/${a.repo}/blob/${rf.branch}/${rf.case_studies}`;
    let md = null;
    let reason = null;
    try {
      md = await readRepoFile(a.id, a.repo, rf.case_studies);
      if (!md.trim()) throw new Error(`${rf.case_studies} is empty`);
      if (Buffer.byteLength(md) > MAX_MD_BYTES)
        throw new Error(`${rf.case_studies} is over ${MAX_MD_BYTES / 1000} KB`);
      if (/^\s*<(!doctype|html)/i.test(md)) throw new Error(`${rf.case_studies} is HTML, not Markdown`);
    } catch (e) {
      reason = e instanceof Fallback ? `${e.kind}: ${e.message}` : String(e?.message ?? e);
      md = null;
    }
    const sample = md == null;
    if (sample) md = await readFile(path.join(FIXTURES, 'case-studies', `${a.id}.md`), 'utf8');
    const file = `case-studies/${a.id}.md`;
    await writeFile(path.join(OUT, file), md);
    items.push({ id: a.id, name: a.name, repo: a.repo, source_url, file, sample, reason });
    log(`case-studies/${a.id}: ${sample ? `SAMPLE — ${reason}` : 'live'}`);
  }
  const index = { generated_at: generatedAt, items };
  schemas.caseStudiesIndex.parse(index);
  await writeFile(path.join(OUT, 'case-studies', 'index.json'), JSON.stringify(index));
  out.case_studies = items.map(({ id, sample, reason }) => ({ id, sample, reason }));
  return out;
}

async function printExtras(extras) {
  const rows = [
    ...extras.evals.map((e) => [
      `evals/${e.id}`,
      e.sample ? 'SAMPLE' : 'live',
      e.sample ? e.reason : `${e.entries} entries`,
    ]),
    ...extras.case_studies.map((c) => [
      `case-studies/${c.id}`,
      c.sample ? 'SAMPLE' : 'live',
      c.reason ?? 'ok',
    ]),
  ];
  const w0 = Math.max(...rows.map((r) => r[0].length));
  log(
    `repo files (${config.repo_files.branch} branch): ${rows.filter((r) => r[1] === 'live').length}/${rows.length} live`,
  );
  for (const r of rows) console.log(`  ${r[0].padEnd(w0)}  ${r[1].padEnd(6)}  ${r[2]}`);
  console.log('');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const esc = (x) => String(x).replace(/\|/g, '\\|');
    const md = [
      `### Evals and case studies (${config.repo_files.branch} branch)`,
      '',
      '| file | data | detail |',
      '| --- | --- | --- |',
      ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
      '',
    ].join('\n');
    await appendFile(process.env.GITHUB_STEP_SUMMARY, md).catch(() => {});
  }
}

function round4(x) {
  return Math.round(x * 10000) / 10000;
}

main().catch((e) => {
  // Only reached on a programming error (e.g. broken fixtures), never on a missing branch.
  console.error('[fetch-data] fatal:', e);
  process.exit(1);
});
