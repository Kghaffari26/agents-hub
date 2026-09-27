import { z } from 'zod';
import { lenient, traceSummary } from './agentic';
import { keyStat, runStatus, timestamp } from './common';

/** One agent's `manifest-entry.json` (agents-core `ManifestEntry`). */
export const manifestEntry = z.object({
  id: z.string(),
  name: z.string(),
  route: z.string().startsWith('/'),
  status: runStatus,
  last_run_at: timestamp,
  last_data_change_at: timestamp.nullable(),
  expected_interval_hours: z.number().int().positive(),
  next_run_hint: z.string(),
  headline: z.string(),
  key_stats: z.array(keyStat).max(4),
  run_cost_usd: z.number().nonnegative(),
  items_count: z.number().int().nullable().optional(),
  /** agents-core v0.3.0; null/absent in older entries. */
  trace_summary: lenient(traceSummary.nullable()),
});
export type ManifestEntry = z.infer<typeof manifestEntry>;

/** Site-assembled `public/data/manifest.json` (SPEC_WEBSITE §3), plus `sample` per agent. */
export const manifest = z.object({
  generated_at: timestamp,
  agents: z.array(
    manifestEntry.extend({
      /** true when the agent's data branch was unavailable and committed fixtures were used. */
      sample: z.boolean().default(false),
      repo: z.string().optional(),
    }),
  ),
});
export type Manifest = z.infer<typeof manifest>;
export type ManifestAgent = Manifest['agents'][number];

/** One agent's `costs-summary.json` (agents-core `CostsSummary`). */
export const agentCostsSummary = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  total_usd: z.number(),
  runs: z.number().int().nonnegative(),
  daily: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), usd: z.number() })),
  all_time_usd: z.number(),
});
export type AgentCostsSummary = z.infer<typeof agentCostsSummary>;

/** Site-assembled `public/data/costs/summary.json` (SPEC_WEBSITE §3). */
export const costSummary = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  total_usd: z.number(),
  by_agent: z.array(z.object({ agent: z.string(), usd: z.number(), runs: z.number().int().nonnegative() })),
  daily: z.array(z.object({ date: z.string(), usd: z.number() })),
  all_time_usd: z.number(),
  avg_cost_per_run: z.array(z.object({ agent: z.string(), usd: z.number() })),
  sample_agents: z.array(z.string()).default([]),
});
export type CostSummary = z.infer<typeof costSummary>;
