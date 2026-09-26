import { z } from 'zod';

/** Shared pieces of every agent's JSON (SPEC_WEBSITE §3, agents-core `schema.py`). */

export const statFormat = z.enum([
  'currency_compact',
  'currency',
  'percent',
  'percent_signed',
  'pp_signed',
  'count',
  'count_signed',
  'count_signed_thousands',
  'decimal1',
  'days',
  'ratio',
]);
export type StatFormat = z.infer<typeof statFormat>;

export const goodDirection = z.enum(['up', 'down', 'neutral']);
export type GoodDirection = z.infer<typeof goodDirection>;

export const runStatus = z.enum(['ok', 'stale', 'failed']);
export type RunStatus = z.infer<typeof runStatus>;

export const narrativeSource = z.enum(['llm', 'template']);

/** ISO timestamp with timezone, e.g. 2026-09-23T14:00:05Z. */
export const timestamp = z.string().datetime({ offset: true });
/** YYYY-MM-DD */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const source = z.object({
  name: z.string(),
  url: z.string().url(),
  retrieved_at: timestamp,
});
export type Source = z.infer<typeof source>;

const tierUsage = z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() });

export const runMeta = z.object({
  agent: z.string(),
  schema_version: z.string().regex(/^\d+\.\d+\.\d+$/, 'expected semver'),
  run_id: z.string(),
  started_at: timestamp,
  finished_at: timestamp,
  status: runStatus,
  data_changed: z.boolean(),
  cost_usd: z.number().nonnegative(),
  model_usage: z.object({ fast: tierUsage, smart: tierUsage }),
  sources: z.array(source),
});
export type RunMeta = z.infer<typeof runMeta>;

export const keyStat = z.object({
  label: z.string(),
  value: z.number().nullable(),
  format: statFormat,
  delta: z.number().nullable().optional(),
  delta_format: statFormat.nullable().optional(),
  good_direction: goodDirection.nullable().optional(),
});
export type KeyStat = z.infer<typeof keyStat>;

/** `{ name, url }` citation used by briefs (the agents' §6 examples). */
export const citation = z.object({
  name: z.string(),
  url: z.string().url(),
  attribution: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});
export type Citation = z.infer<typeof citation>;

/** Columnar series: `{ dates: [...], values: [...] }`, nulls allowed. */
export const columnar = z
  .object({ dates: z.array(isoDate), values: z.array(z.number().nullable()) })
  .refine((s) => s.dates.length === s.values.length, 'dates and values must be the same length');

/** Semver major check (SPEC_WEBSITE §3 step 5). */
export function assertMajor(meta: { agent: string; schema_version: string }, supportedMajor: number, file: string) {
  const major = Number(meta.schema_version.split('.')[0]);
  if (major !== supportedMajor) {
    throw new Error(
      `${file}: agent "${meta.agent}" publishes schema_version ${meta.schema_version}, but this site supports major ${supportedMajor}. Update the site's validators for the new contract.`,
    );
  }
}
