import { afterAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Runs scripts/fetch-data.mjs offline with `--local` sources: real agent output goes live, and
 * each kind of breakage falls back to sample data with the exact reason in the report and log.
 */
describe('fetch-data: live vs sample, with the reason', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'fetch-data-'));
  const out = path.join(tmp, 'out');
  // macro: valid real output with one value broken → validation fallback naming the zod path.
  const badMacro = path.join(tmp, 'macro');
  cpSync('test/fixtures/real/macro', badMacro, { recursive: true });
  const latest = JSON.parse(readFileSync(`${badMacro}/latest.json`, 'utf8'));
  latest.indicators[0].primary.value = 'n/a';
  writeFileSync(`${badMacro}/latest.json`, JSON.stringify(latest));
  // grants: manifest-entry.json missing → missing_file fallback.
  const noManifest = path.join(tmp, 'grants');
  cpSync('test/fixtures/real/grants', noManifest, { recursive: true });
  rmSync(`${noManifest}/manifest-entry.json`);

  const log = execFileSync(
    'node',
    [
      'scripts/fetch-data.mjs',
      '--offline',
      '--local',
      'real_estate=test/fixtures/real/real_estate',
      '--local',
      `macro=${badMacro}`,
      '--local',
      `grants=${noManifest}`,
    ],
    { env: { ...process.env, FETCH_OUT_DIR: out }, encoding: 'utf8' },
  );
  const report = JSON.parse(readFileSync(`${out}/_fetch-report.json`, 'utf8'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  const byId = Object.fromEntries(report.agents.map((a: { id: string }) => [a.id, a]));

  it('real output is used live', () => {
    expect(byId.real_estate).toMatchObject({ sample: false, reason: null, schema_version: '1.0.0' });
    const manifest = JSON.parse(readFileSync(`${out}/manifest.json`, 'utf8'));
    expect(manifest.agents.find((a: { id: string }) => a.id === 'real_estate').sample).toBe(false);
  });
  it('a contract violation names the file and zod path', () => {
    expect(byId.macro.sample).toBe(true);
    expect(byId.macro.reason).toMatchObject({ kind: 'validation', file: 'latest.json' });
    expect(byId.macro.reason.issues[0].path).toBe('indicators.0.primary.value');
    expect(log).toMatch(
      /macro: SAMPLE DATA — validation: latest\.json failed validation at indicators\.0\.primary\.value/,
    );
  });
  it('a missing file is reported as such', () => {
    expect(byId.grants.reason).toMatchObject({ kind: 'missing_file', file: 'manifest-entry.json' });
  });
  it('offline agents say so, and the log ends with a summary table', () => {
    expect(byId.repo_maint.reason.kind).toBe('offline');
    expect(log).toMatch(/summary: 1\/4 agents live, 3 using sample data/);
    expect(log).toMatch(/real_estate\s+live\s+9\s+1\.0\.0/);
    expect(log).toMatch(/grants\s+SAMPLE\s+—\s+missing_file/);
  });
});

describe('fetch-data: eval history and case studies from the default branch', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'fetch-repo-'));
  const out = path.join(tmp, 'out');
  // grants repo checkout: two valid history lines, one invalid, and a case-studies file.
  const repo = path.join(tmp, 'sam-agent');
  mkdirSync(path.join(repo, 'evals'), { recursive: true });
  mkdirSync(path.join(repo, 'docs'), { recursive: true });
  writeFileSync(
    path.join(repo, 'evals', 'history.jsonl'),
    [
      JSON.stringify({
        ts: '2026-09-20T10:00:00Z',
        suite: 'fit_scoring',
        scores: { recommendation_exact: 0.8 },
        pass_rate: 0.7,
        usd: 0.1,
      }),
      '{not json',
      JSON.stringify({
        ts: '2026-09-27T10:00:00Z',
        suite: 'fit_scoring',
        scores: { recommendation_exact: 0.85 },
        pass_rate: 0.75,
        usd: 0.1,
      }),
    ].join('\n'),
  );
  writeFileSync(path.join(repo, 'docs', 'case-studies.md'), '# Case studies\n\n## A real one\n\nText.\n');
  // real_estate data: valid §6 body with a malformed agentic field → stays live, with a warning.
  const re = path.join(tmp, 're');
  cpSync('test/fixtures/real/real_estate', re, { recursive: true });
  const latest = JSON.parse(readFileSync(`${re}/latest.json`, 'utf8'));
  latest.investigations = [{ slug: 'austin-tx' }];
  writeFileSync(`${re}/latest.json`, JSON.stringify(latest));

  const log = execFileSync(
    'node',
    ['scripts/fetch-data.mjs', '--offline', '--local-repo', `grants=${repo}`, '--local', `real_estate=${re}`],
    { env: { ...process.env, FETCH_OUT_DIR: out }, encoding: 'utf8' },
  );
  const report = JSON.parse(readFileSync(`${out}/_fetch-report.json`, 'utf8'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('reads a repo checkout live, skipping invalid lines', () => {
    const grants = JSON.parse(readFileSync(`${out}/evals/grants.json`, 'utf8'));
    expect(grants).toMatchObject({ sample: false, skipped_lines: 1 });
    expect(
      grants.entries.map((e: { scores: { recommendation_exact: number } }) => e.scores.recommendation_exact),
    ).toEqual([0.8, 0.85]);
    expect(log).toMatch(/evals\/grants: live — 2 entries \(1 invalid lines skipped\)/);
  });
  it('falls back to sample evals and write-ups with the reason', () => {
    const macro = JSON.parse(readFileSync(`${out}/evals/macro.json`, 'utf8'));
    expect(macro.sample).toBe(true);
    expect(macro.reason).toMatch(/offline/);
    expect(macro.entries.length).toBeGreaterThan(4);
    const idx = JSON.parse(readFileSync(`${out}/case-studies/index.json`, 'utf8'));
    const byId = Object.fromEntries(idx.items.map((i: { id: string }) => [i.id, i]));
    expect(byId.grants.sample).toBe(false);
    expect(readFileSync(`${out}/case-studies/grants.md`, 'utf8')).toMatch(/A real one/);
    expect(byId.macro.sample).toBe(true);
    expect(report.extras.evals.find((e: { id: string }) => e.id === 'agents_mcp').sample).toBe(true);
  });
  it('a malformed agentic field is a warning, not a fallback; a missing trace is noted', () => {
    const r = report.agents.find((a: { id: string }) => a.id === 'real_estate');
    expect(r.sample).toBe(false);
    expect(r.warnings.join('\n')).toMatch(/investigations doesn't match the documented shape/);
    expect(r.warnings.join('\n')).toMatch(/no trace\.json yet/);
    const idx = JSON.parse(readFileSync(`${out}/real_estate/latest.json`, 'utf8'));
    expect(idx.investigations).toEqual([{ slug: 'austin-tx' }]); // file is copied as published; the site drops it on read
  });
});
