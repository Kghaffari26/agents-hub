import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { ZodTypeAny } from 'zod';
import {
  AGENT_FILE_SCHEMAS,
  COMMON_FILE_SCHEMAS,
  SUPPORTED_MAJOR,
  assertMajor,
  runMeta,
} from '@/lib/schemas';
import { metricValue } from '@/lib/schemas/realEstate';
import { repoMaintLatest } from '@/lib/schemas/repoMaint';

/**
 * Trimmed copies of REAL agent runs (scripts/trim_real_fixture.py; provenance in
 * test/fixtures/real/README.md). Folder name = agent id, optionally `<agent>__<variant>`.
 */
const ROOT = 'test/fixtures/real';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : [];
  });
}

function schemaFor(agent: string, rel: string): ZodTypeAny | null {
  const common = (COMMON_FILE_SCHEMAS as Record<string, ZodTypeAny>)[rel];
  if (common) return common;
  const map = (AGENT_FILE_SCHEMAS as Record<string, Record<string, ZodTypeAny>>)[agent] ?? {};
  if (map[rel]) return map[rel];
  if (rel.startsWith('metros/')) return map['metros/*.json'] ?? null;
  return null;
}

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

describe('contract: real agent output validates', () => {
  const dirs = readdirSync(ROOT).filter((d) => statSync(path.join(ROOT, d)).isDirectory());
  it('has real output for all four agents', () => {
    for (const a of ['real_estate', 'macro', 'grants', 'repo_maint']) expect(dirs).toContain(a);
  });
  for (const dir of dirs) {
    const agent = dir.split('__')[0];
    for (const f of walk(path.join(ROOT, dir))) {
      const rel = path.relative(path.join(ROOT, dir), f).split(path.sep).join('/');
      it(`${dir}/${rel}`, () => {
        const schema = schemaFor(agent, rel);
        expect(schema, `no schema mapped for ${agent}/${rel}`).not.toBeNull();
        const data = read(f);
        const res = schema!.safeParse(data);
        if (!res.success) throw new Error(JSON.stringify(res.error.issues.slice(0, 3)));
        if (rel === 'latest.json') {
          expect(data.meta.agent).toBe(agent);
          assertMajor(data.meta, SUPPORTED_MAJOR[agent], `${dir}/latest.json`);
        }
      });
    }
  }
});

describe('contract: meta follows agents-core RunMeta (v0.1.0, forward-compatible with v0.2.0)', () => {
  const base = read(`${ROOT}/macro/latest.json`).meta;

  it('accepts a v0.1.0 meta as published', () => {
    expect(runMeta.safeParse(base).success).toBe(true);
  });
  it('accepts schema_version 1.1.0 with warnings and unknown extra keys, and keeps them', () => {
    const next = { ...base, schema_version: '1.1.0', warnings: ['permits skipped'], fred_requests: 39 };
    const res = runMeta.safeParse(next);
    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({ warnings: ['permits skipped'], fred_requests: 39 });
    expect(() => assertMajor(next, 1, 'x')).not.toThrow();
  });
  it('rejects non-string warnings and a missing RunMeta field', () => {
    expect(runMeta.safeParse({ ...base, warnings: [1] }).success).toBe(false);
    const noRunId = { ...base };
    delete noRunId.run_id;
    expect(runMeta.safeParse(noRunId).success).toBe(false);
  });
  it('rejects a new major (2.0.0) with a clear message', () => {
    expect(() => assertMajor({ ...base, schema_version: '2.0.0' }, 1, 'macro/latest.json')).toThrow(
      /supports major 1/,
    );
  });
  it('agent-specific meta extensions still apply on top of passthrough', () => {
    const rm = read(`${ROOT}/repo_maint/latest.json`);
    expect(repoMaintLatest.safeParse({ ...rm, meta: { ...rm.meta, github_requests: 'many' } }).success).toBe(
      false,
    );
  });
});

describe('contract: tolerated agent deviations (TODOs in STATUS.md)', () => {
  it('repo_maint changelog narrative_source "deterministic" is read as "template"', () => {
    const rm = read(`${ROOT}/repo_maint/latest.json`);
    const withDeterministic = rm.repos.find(
      (r: { changelog: { narrative_source: string } | null }) => r.changelog,
    );
    expect(withDeterministic.changelog.narrative_source).toBe('deterministic');
    const parsed = repoMaintLatest.parse(rm);
    expect(parsed.repos.find((r) => r.changelog)!.changelog!.narrative_source).toBe('template');
  });
  it('real_estate "<unit>_signed" delta formats map to StatFormat (unknown → null)', () => {
    expect(metricValue.parse({ value: 42, delta_format: 'days_signed' }).delta_format).toBe('days');
    expect(metricValue.parse({ value: 4.1, delta_format: 'months_signed' }).delta_format).toBe('decimal1');
    expect(metricValue.parse({ value: 1, delta_format: 'diff_signed' }).delta_format).toBeNull();
    expect(metricValue.parse({ value: 1, delta_format: 'pp_signed' }).delta_format).toBe('pp_signed');
    expect(metricValue.safeParse({ value: 1, delta_format: 'bogus' }).success).toBe(false);
  });
});
