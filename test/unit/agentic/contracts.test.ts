import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { realEstateLatest, metroDetail } from '@/lib/schemas/realEstate';
import { macroLatest } from '@/lib/schemas/macro';
import { grantsLatest } from '@/lib/schemas/grants';
import { repoMaintLatest } from '@/lib/schemas/repoMaint';
import { manifestEntry } from '@/lib/schemas/manifest';
import {
  evalHistoryLine,
  evalsData,
  lenientArray,
  looseCitation,
  macroInvestigation,
  trace,
  investigation,
  investigationSummary,
  grantsResearch,
  fixProposal,
} from '@/lib/schemas/agentic';
import { z } from 'zod';
import * as allSchemas from '@/lib/schemas';
import { agenticWarnings } from '../../../scripts/lib/contracts.mjs';

const j = (p: string) => JSON.parse(readFileSync(`test/fixtures/${p}`, 'utf8'));

describe('agentic §6.x fields in the sample fixtures', () => {
  it('parse and survive validation (not silently dropped)', () => {
    expect(realEstateLatest.parse(j('real_estate/latest.json')).investigations?.map((i) => i.slug)).toEqual([
      'detroit-mi',
    ]);
    expect(metroDetail.parse(j('real_estate/metros/detroit-mi.json')).investigation?.trigger).toBe(
      'top_mover',
    );
    expect(metroDetail.parse(j('real_estate/metros/tampa-fl.json')).investigation).toBeNull();
    const inv = macroLatest.parse(j('macro/latest.json')).investigation;
    expect(inv?.trigger.type).toBe('fomc_decision');
    expect(inv?.cited_series.map((c) => c.id)).toEqual(['cpi', 'core_cpi', 'payrolls', 'unrate']);
    const g = grantsLatest.parse(j('grants/latest.json'));
    const rs = g.top_matches.filter((m) => m.research).map((m) => m.research!);
    expect(rs.length).toBeGreaterThanOrEqual(2);
    expect(rs.every((b) => b.prior_awards.every((a) => a.url.includes('usaspending.gov')))).toBe(true);
    const r = repoMaintLatest.parse(j('repo_maint/latest.json'));
    const sandbox = r.repos.find((x) => x.role === 'sandbox')!;
    expect(sandbox.fix_proposals?.map((p) => p.status)).toEqual(['proposed', 'no_fix']);
    expect(r.repos.filter((x) => x.role !== 'sandbox').every((x) => x.fix_proposals?.length === 0)).toBe(
      true,
    );
  });

  it('every trace fixture matches agents-core Trace and its summary is consistent', () => {
    for (const a of ['real_estate', 'macro', 'grants', 'repo_maint']) {
      const t = trace.parse(j(`${a}/trace.json`));
      expect(t.summary.llm_calls).toBe(t.spans.filter((s) => s.kind === 'llm_call').length);
      expect(t.summary.tool_calls).toBe(t.spans.filter((s) => s.kind === 'tool_call').length);
      const llmUsd = t.spans
        .filter((s) => s.kind === 'llm_call')
        .reduce((s, x) => s + Number(x.attrs.usd), 0);
      expect(t.summary.cost_usd).toBeCloseTo(llmUsd, 4);
      // The published run cost and the trace agree.
      expect(t.summary.cost_usd).toBeCloseTo(j(`${a}/latest.json`).meta.cost_usd, 3);
      expect(manifestEntry.parse(j(`${a}/manifest-entry.json`)).trace_summary).toEqual(t.summary);
    }
  });
});

describe("the agents' own published excerpts", () => {
  it('fed-agent §6.1 investigation and its trace.json parse', () => {
    const ex = j('real-excerpts/macro-latest-excerpt.json');
    const inv = macroInvestigation.parse(ex.investigation);
    expect(inv.loop?.tool_calls).toEqual(['get_fomc_context', 'get_series', 'get_series']);
    expect(inv.cited_series.map((c) => c.fred_series)).toEqual(['CPIAUCSL', 'UNRATE']);
    expect(agenticWarnings(allSchemas, 'macro', 'latest.json', ex)).toEqual([]);
    const t = trace.parse(j('real-excerpts/macro-trace-excerpt.json'));
    expect(t.summary).toMatchObject({ llm_calls: 5, tool_calls: 3, steps: 2 });
    expect(t.spans.some((s) => s.kind === 'agent_loop')).toBe(true);
  });
});

describe('older data (before the agentic additions)', () => {
  it('still parses with every new field absent', () => {
    const re = j('real_estate/latest.json');
    delete re.investigations;
    expect(realEstateLatest.parse(re).investigations).toBeUndefined();
    const m = j('real_estate/manifest-entry.json');
    delete m.trace_summary;
    expect(manifestEntry.parse(m).trace_summary).toBeUndefined();
    expect(manifestEntry.parse({ ...m, trace_summary: null }).trace_summary).toBeNull();
    const g = j('grants/latest.json');
    for (const t of g.top_matches) delete t.research;
    expect(grantsLatest.parse(g).top_matches.every((t) => t.research === undefined)).toBe(true);
  });
  it("repo-maintain-agent's committed 1.1.0 run (with trace.json) validates", () => {
    const r = repoMaintLatest.parse(j('real-excerpts/repo_maint-1.1.0/latest.json'));
    expect(r.meta.schema_version).toBe('1.1.0');
    expect(r.repos.every((x) => Array.isArray(x.fix_proposals))).toBe(true);
    expect(trace.parse(j('real-excerpts/repo_maint-1.1.0/trace.json')).agent).toBe('repo_maint');
    expect(
      manifestEntry.parse(j('real-excerpts/repo_maint-1.1.0/manifest-entry.json')).trace_summary,
    ).toBeTruthy();
  });
  it('the real agent outputs (pre-v0.3.0) still validate', () => {
    expect(() => repoMaintLatest.parse(j('real/repo_maint/latest.json'))).not.toThrow();
    expect(() => macroLatest.parse(j('real/macro/latest.json'))).not.toThrow();
  });
});

describe('tolerance: a malformed new field never takes the agent down', () => {
  it('drops only the bad field / item', () => {
    const re = j('real_estate/latest.json');
    re.investigations.push({ ...re.investigations[0], slug: 'x', summary: 42 });
    const parsed = realEstateLatest.parse(re);
    expect(parsed.investigations?.map((i) => i.slug)).toEqual(['detroit-mi']);
    const mac = j('macro/latest.json');
    mac.investigation.trigger = 'oops';
    expect(macroLatest.parse(mac).investigation).toBeUndefined();
    const g = j('grants/latest.json');
    g.top_matches[0].research = { go_no_go: 'maybe' };
    expect(grantsLatest.parse(g).top_matches[0].research).toBeUndefined();
    const rm = j('repo_maint/latest.json');
    const sb = rm.repos.findIndex((x: { role: string }) => x.role === 'sandbox');
    rm.repos[sb].fix_proposals[1].issue_number = 'x';
    expect(repoMaintLatest.parse(rm).repos[sb].fix_proposals?.map((p) => p.id)).toEqual(['7c41e09a2b3f']);
    expect(agenticWarnings(allSchemas, 'repo_maint', 'latest.json', rm)[0]).toMatch(
      /repos\.5\.fix_proposals\.1\.issue_number/,
    );
    const m = j('grants/manifest-entry.json');
    m.trace_summary = 'n/a';
    expect(manifestEntry.parse(m).trace_summary).toBeUndefined();
  });
  it('fetch-data reports the drop as a warning with the path', () => {
    const schemas = allSchemas;
    const re = j('real_estate/latest.json');
    re.investigations[0].cited_metrics = 'inventory';
    const w = agenticWarnings(schemas, 'real_estate', 'latest.json', re);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/investigations\.0\.cited_metrics/);
    expect(agenticWarnings(schemas, 'real_estate', 'latest.json', j('real_estate/latest.json'))).toEqual([]);
    const metro = j('real_estate/metros/detroit-mi.json');
    metro.investigation = { slug: 1 };
    expect(agenticWarnings(schemas, 'real_estate', 'metros/tampa-fl.json', metro)[0]).toMatch(
      /investigation/,
    );
  });
  it('lenientArray keeps the valid items', () => {
    expect(lenientArray(looseCitation).parse([{ url: 'https://x.test/a' }, { url: 'nope' }])).toHaveLength(1);
    expect(lenientArray(looseCitation).parse(7)).toBeUndefined();
  });
  it('citations accept agents-core `source` or site `name`', () => {
    expect(looseCitation.parse({ source: 'FRED', url: 'https://fred.stlouisfed.org/' }).name).toBe('FRED');
    expect(looseCitation.parse({ url: 'https://www.usaspending.gov/award/X' }).name).toBe(
      'www.usaspending.gov',
    );
  });
  it('an unknown span kind reads as custom', () => {
    const t = j('macro/trace.json');
    t.spans[0].kind = 'retrieval';
    expect(trace.parse(t).spans[0].kind).toBe('custom');
    expect(() => trace.parse({ ...t, trace_schema_version: '2.0.0' })).toThrow();
  });
});

describe('eval history lines', () => {
  it('normalizes agents-core and agents-mcp spellings', () => {
    const core = evalHistoryLine.parse({
      ts: '2026-09-26T16:00:00Z',
      suite: 'triage',
      scores: { classification_exact: 0.9 },
      pass_rate: 0.8,
      usd: 0.1,
    });
    expect(core).toMatchObject({ suite: 'triage', usd: 0.1, pass_rate: 0.8, counts: {} });
    const mcp = evalHistoryLine.parse({
      date: '2026-09-26',
      git_sha: '39a882c',
      scores: { n: 25, tool_accuracy: 1 },
      cost_usd: 0.2043,
    });
    expect(mcp).toMatchObject({
      ts: '2026-09-26T00:00:00Z',
      suite: 'default',
      scores: { tool_accuracy: 1 },
      counts: { n: 25 },
      n_cases: 25,
      usd: 0.2043,
    });
    expect(evalHistoryLine.safeParse({ scores: {} }).success).toBe(false);
    expect(evalHistoryLine.safeParse({ ts: 'yesterday', scores: {} }).success).toBe(false);
  });
  it('the sample histories are valid and chronological', () => {
    for (const id of ['real_estate', 'macro', 'grants', 'repo_maint', 'agents_mcp']) {
      const lines = readFileSync(`test/fixtures/evals/${id}.jsonl`, 'utf8').trim().split('\n');
      const entries = lines.map((l) => evalHistoryLine.parse(JSON.parse(l)));
      expect(entries.length).toBeGreaterThan(4);
      expect(entries.every((e) => e.ts <= '2026-09-27')).toBe(true);
      expect(entries.every((e) => (e.prompt_version ?? '') <= '2026-09-27')).toBe(true);
      expect(
        evalsData.safeParse({
          id,
          name: id,
          repo: 'x/y',
          source_url: 'https://github.com/x/y',
          sample: true,
          entries,
        }).success,
      ).toBe(true);
    }
  });
});

describe('the JSON examples in each agent spec', () => {
  const ex = j('real-excerpts/spec-examples.json');
  it('parse with the site schemas', () => {
    expect(investigation.parse(ex.real_estate_investigation).trigger).toBe('top_mover');
    expect(z.array(investigationSummary).parse(ex.real_estate_investigations)).toHaveLength(1);
    const r = grantsResearch.parse(ex.grants_research);
    expect(r.go_no_go).toBe('go');
    expect(r.citations[0].name).toBe('USAspending.gov'); // agents-core `source` spelling
    expect(fixProposal.parse(ex.repo_fix_proposal).status).toBe('proposed');
  });
});
