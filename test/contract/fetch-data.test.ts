import { afterAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
