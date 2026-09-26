import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('build-time loader', () => {
  it('a corrupted data file fails with an error naming the file and field', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'data-'));
    mkdirSync(path.join(dir, 'macro'));
    copyFileSync('test/fixtures-broken/macro-latest.broken.json', path.join(dir, 'macro/latest.json'));
    vi.stubEnv('DATA_DIR', dir);
    vi.resetModules();
    const { getMacro } = await import('@/lib/data/server');
    expect(() => getMacro()).toThrowError(
      /macro\/latest\.json failed validation[\s\S]*indicators\.3\.primary\.value/,
    );
    vi.unstubAllEnvs();
  });
  it('rejects an unsupported schema major version', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'data-'));
    mkdirSync(path.join(dir, 'repo_maint'));
    const { readFileSync } = await import('node:fs');
    const d = JSON.parse(readFileSync('test/fixtures/repo_maint/latest.json', 'utf8'));
    d.meta.schema_version = '2.0.0';
    writeFileSync(path.join(dir, 'repo_maint/latest.json'), JSON.stringify(d));
    vi.stubEnv('DATA_DIR', dir);
    vi.resetModules();
    const { getRepoMaint } = await import('@/lib/data/server');
    expect(() => getRepoMaint()).toThrowError(/schema_version 2\.0\.0.*supports major 1/);
    vi.unstubAllEnvs();
  });
});
