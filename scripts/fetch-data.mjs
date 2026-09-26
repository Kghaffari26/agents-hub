#!/usr/bin/env node
/**
 * Assemble public/data/ from each agent's `data` branch.
 *
 *   node scripts/fetch-data.mjs            # live fetch, per-agent fallback to fixtures
 *   node scripts/fetch-data.mjs --offline  # fixtures only (no network)
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
 * This script never exits non-zero because an agent hasn't published yet.
 */
import { cp, mkdir, readFile, rm, writeFile, readdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data');
const FIXTURES = path.join(ROOT, 'test', 'fixtures');
const OFFLINE = process.argv.includes('--offline') || process.env.FETCH_OFFLINE === '1';
const HISTORY_KEEP = Number(process.env.FETCH_HISTORY_KEEP ?? 7);
const TIMEOUT_MS = 20_000;

const config = JSON.parse(await readFile(path.join(ROOT, 'config', 'sources.json'), 'utf8'));
const schemas = await tsImport(
  pathToFileURL(path.join(ROOT, 'src/lib/schemas/index.ts')).href,
  import.meta.url,
);

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

async function fetchText(url) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.status === 404) throw Object.assign(new Error(`404 ${url}`), { notFound: true });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (e.notFound) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw lastErr;
}

function schemaFor(agentId, rel) {
  const common = schemas.COMMON_FILE_SCHEMAS[rel];
  if (common) return common;
  const map = schemas.AGENT_FILE_SCHEMAS[agentId] ?? {};
  if (map[rel]) return map[rel];
  for (const [pattern, s] of Object.entries(map)) {
    if (pattern.includes('*')) {
      const re = new RegExp('^' + pattern.replace('.', '\\.').replace('*', '[^/]+') + '$');
      if (re.test(rel)) return s;
    }
  }
  return null;
}

function validate(agentId, rel, data) {
  const s = schemaFor(agentId, rel);
  if (!s) return;
  const res = s.safeParse(data);
  if (!res.success) {
    const issue = res.error.issues[0];
    throw new Error(
      `${agentId}/${rel} failed validation at ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
  }
  if (rel === 'latest.json') {
    const major = schemas.SUPPORTED_MAJOR[agentId];
    if (major != null) schemas.assertMajor(data.meta, major, `${agentId}/latest.json`);
  }
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

async function fetchAgent(agent, dest) {
  const base = `${config.raw_base}/${agent.repo}/${agent.branch}`;
  const files = new Map();
  const get = async (rel, { optional = false } = {}) => {
    try {
      const text = await fetchText(`${base}/${rel}`);
      const data = JSON.parse(text);
      validate(agent.id, rel, data);
      files.set(rel, text);
      return data;
    } catch (e) {
      if (optional) return null;
      throw e;
    }
  };
  const latest = await get('latest.json');
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
  const history = await listHistory(agent);
  await pool(history, 4, (n) => get(`history/${n}`, { optional: true }));

  for (const [rel, text] of files) {
    const p = path.join(dest, rel);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, text);
  }
  return { fileCount: files.size };
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
    if (OFFLINE) {
      sample = true;
      reason = 'offline mode';
    } else {
      try {
        const { fileCount } = await fetchAgent(agent, tmp);
        log(`${agent.id}: fetched ${fileCount} files from ${agent.repo}@${agent.branch}`);
      } catch (e) {
        sample = true;
        reason = e.notFound ? `data branch or file not found (${e.message})` : String(e.message ?? e);
      }
    }
    if (sample) {
      await rm(tmp, { recursive: true, force: true });
      await copyFixtures(agent.id, tmp);
      log(`${agent.id}: using committed fixtures (sample data) — ${reason}`);
    }
    await rm(dest, { recursive: true, force: true });
    await rename(tmp, dest);
    report.push({ id: agent.id, repo: agent.repo, sample, reason });
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
  await writeFile(
    path.join(OUT, '_fetch-report.json'),
    JSON.stringify({ generated_at: manifest.generated_at, offline: OFFLINE, agents: report }, null, 2),
  );
  const live = report.filter((r) => !r.sample).length;
  log(`done: ${live}/${report.length} agents live, ${report.length - live} using sample data`);
  const list = await readdir(OUT);
  log(`public/data: ${list.join(', ')}`);
}

function round4(x) {
  return Math.round(x * 10000) / 10000;
}

main().catch((e) => {
  // Only reached on a programming error (e.g. broken fixtures), never on a missing branch.
  console.error('[fetch-data] fatal:', e);
  process.exit(1);
});
