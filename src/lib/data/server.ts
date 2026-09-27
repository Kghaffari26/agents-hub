import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ZodType, ZodTypeDef } from 'zod';
import { assertMajor, costSummary, manifest, SUPPORTED_MAJOR } from '../schemas';
import { realEstateLatest, metroDetail } from '../schemas/realEstate';
import { macroLatest } from '../schemas/macro';
import { grantsLatest } from '../schemas/grants';
import { repoMaintLatest } from '../schemas/repoMaint';
import { caseStudiesIndex, evalsData, trace, type TraceSummary } from '../schemas/agentic';
import { existsSync } from 'node:fs';

/**
 * Build-time loaders (SPEC_WEBSITE §8). Read from public/data (or DATA_DIR), validate with
 * zod, and throw an error naming the file and the zod path — a failed build beats a broken page.
 */
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), 'public', 'data'));

export class DataValidationError extends Error {}

const cache = new Map<string, unknown>();

export function loadJson<T>(rel: string, schema: ZodType<T, ZodTypeDef, unknown>): T {
  const file = path.join(DATA_DIR, rel);
  if (cache.has(file)) return cache.get(file) as T;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new DataValidationError(`Data file ${file} could not be read or parsed: ${(e as Error).message}`);
  }
  const res = schema.safeParse(raw);
  if (!res.success) {
    const lines = res.error.issues
      .slice(0, 5)
      .map((i) => `  - at "${i.path.join('.') || '(root)'}": ${i.message}`)
      .join('\n');
    throw new DataValidationError(`Data file ${file} failed validation:\n${lines}`);
  }
  const data = res.data as T & { meta?: { agent: string; schema_version: string } };
  const agent = rel.split('/')[0];
  if (rel.endsWith('latest.json') && data.meta && SUPPORTED_MAJOR[agent] != null) {
    assertMajor(data.meta, SUPPORTED_MAJOR[agent], file);
  }
  cache.set(file, data);
  return data;
}

export const getManifest = () => loadJson('manifest.json', manifest);
export const getCostSummary = () => loadJson('costs/summary.json', costSummary);
export const getRealEstateIndex = () => loadJson('real_estate/latest.json', realEstateLatest);
export const getMetro = (slug: string) => loadJson(`real_estate/metros/${slug}.json`, metroDetail);
export const getMacro = () => loadJson('macro/latest.json', macroLatest);
export const getGrantsLatest = () => loadJson('grants/latest.json', grantsLatest);
export const getRepoMaint = () => loadJson('repo_maint/latest.json', repoMaintLatest);

export function getAgent(id: string) {
  const a = getManifest().agents.find((x) => x.id === id);
  if (!a) throw new DataValidationError(`manifest.json has no agent "${id}"`);
  return a;
}

/**
 * Build-time facts about an agent's trace.json (the spans stay out of page props; the Run trace
 * panel fetches the file when opened). Null when the agent hasn't published one.
 */
export interface TraceInfo {
  runId: string;
  summary: TraceSummary;
  spans: number;
  truncated: boolean;
  droppedSpans: number;
  path: string;
}
export function getTraceInfo(agentId: string): TraceInfo | null {
  const rel = `${agentId}/trace.json`;
  if (!existsSync(path.join(DATA_DIR, rel))) return null;
  const t = loadJson(rel, trace);
  return {
    runId: t.run_id,
    summary: t.summary,
    spans: t.spans.length,
    truncated: t.truncated,
    droppedSpans: t.dropped_spans,
    path: rel,
  };
}

/** Eval history for an agent (or agents_mcp); null when fetch-data didn't write one. */
export function getEvals(id: string) {
  const rel = `evals/${id}.json`;
  if (!existsSync(path.join(DATA_DIR, rel))) return null;
  return loadJson(rel, evalsData);
}

export function getCaseStudies() {
  const index = loadJson('case-studies/index.json', caseStudiesIndex);
  return index.items.map((item) => {
    const file = path.join(DATA_DIR, item.file);
    let markdown: string;
    try {
      markdown = readFileSync(file, 'utf8');
    } catch (e) {
      throw new DataValidationError(`Case study ${file} could not be read: ${(e as Error).message}`);
    }
    return { ...item, markdown };
  });
}
