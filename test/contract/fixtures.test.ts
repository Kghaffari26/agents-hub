import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { ZodTypeAny } from 'zod';
import { AGENT_FILE_SCHEMAS, COMMON_FILE_SCHEMAS, manifest, costSummary } from '@/lib/schemas';
import { macroLatest } from '@/lib/schemas/macro';
import { metroDetail } from '@/lib/schemas/realEstate';

const ROOT = 'test/fixtures';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : [];
  });
}

function schemaFor(agent: string, rel: string): ZodTypeAny | null {
  if (rel.startsWith('history/')) rel = 'latest.json'; // history snapshots are latest.json copies
  const common = (COMMON_FILE_SCHEMAS as Record<string, ZodTypeAny>)[rel];
  if (common) return common;
  const map = (AGENT_FILE_SCHEMAS as Record<string, Record<string, ZodTypeAny>>)[agent] ?? {};
  if (map[rel]) return map[rel];
  if (rel.startsWith('metros/')) return map['metros/*.json'] ?? null;
  return null;
}

describe('contract: every fixture validates against its zod schema', () => {
  const files = walk(ROOT);
  it('found fixtures for all four agents', () => {
    for (const a of ['real_estate', 'macro', 'grants', 'repo_maint']) {
      expect(files.some((f) => f.includes(`/${a}/latest.json`))).toBe(true);
      expect(files.some((f) => f.includes(`/${a}/manifest-entry.json`))).toBe(true);
      expect(files.some((f) => f.includes(`/${a}/costs-summary.json`))).toBe(true);
    }
  });
  for (const f of files) {
    const [agent, ...rest] = path.relative(ROOT, f).split(path.sep);
    const rel = rest.join('/');
    it(`${agent}/${rel}`, () => {
      const schema = schemaFor(agent, rel);
      expect(schema, `no schema mapped for ${agent}/${rel}`).not.toBeNull();
      const res = schema!.safeParse(JSON.parse(readFileSync(f, 'utf8')));
      if (!res.success) throw new Error(JSON.stringify(res.error.issues.slice(0, 3)));
    });
  }
});

describe('contract: cross-file consistency', () => {
  const idx = JSON.parse(readFileSync(`${ROOT}/real_estate/latest.json`, 'utf8'));
  it('every metro in the index has a metro file with the same slug', () => {
    for (const m of idx.metros) {
      const d = JSON.parse(readFileSync(`${ROOT}/real_estate/metros/${m.slug}.json`, 'utf8'));
      expect(d.slug).toBe(m.slug);
    }
  });
  it('alerts and movers only reference known slugs', () => {
    const slugs = new Set(idx.metros.map((m: { slug: string }) => m.slug));
    for (const a of idx.alerts) for (const s of a.slugs) expect(slugs.has(s)).toBe(true);
    for (const list of Object.values(idx.movers) as { slug: string }[][])
      for (const m of list) expect(slugs.has(m.slug)).toBe(true);
  });
  it('size budgets: index ≤ 150KB, macro ≤ 350KB, metro files ≤ 40KB', () => {
    expect(statSync(`${ROOT}/real_estate/latest.json`).size).toBeLessThan(150_000);
    expect(statSync(`${ROOT}/macro/latest.json`).size).toBeLessThan(350_000);
    for (const f of readdirSync(`${ROOT}/real_estate/metros`))
      expect(statSync(`${ROOT}/real_estate/metros/${f}`).size).toBeLessThan(40_000);
  });
  it('assembled public/data validates when present', () => {
    try {
      manifest.parse(JSON.parse(readFileSync('public/data/manifest.json', 'utf8')));
      costSummary.parse(JSON.parse(readFileSync('public/data/costs/summary.json', 'utf8')));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  });
});

describe('contract: deliberately broken fixtures must fail', () => {
  it('macro with a string value fails, naming the path', () => {
    const res = macroLatest.safeParse(
      JSON.parse(readFileSync('test/fixtures-broken/macro-latest.broken.json', 'utf8')),
    );
    expect(res.success).toBe(false);
    expect(res.error!.issues[0].path.join('.')).toBe('indicators.3.primary.value');
  });
  it('metro file without series.dates fails', () => {
    const res = metroDetail.safeParse(
      JSON.parse(readFileSync('test/fixtures-broken/metro-missing-dates.broken.json', 'utf8')),
    );
    expect(res.success).toBe(false);
  });
});
