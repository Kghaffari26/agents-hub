import { z } from 'zod';
import { isoDate, narrativeSource } from './common';

/**
 * The agentic additions (agents-core v0.3.0 and each agent spec's §6.x): run traces, eval
 * history, and the four agent-loop outputs (real-estate metro investigations, macro "what's
 * driving this" release investigation, grants bid research, repo fix proposals). The macro,
 * grants, repo and real-estate shapes are the agents' own published §6.x contracts (2026-09-27).
 *
 * These are newer than the §6 bodies and still settling, so they're read tolerantly:
 *  - every new field is optional (older runs don't have it) and most inner fields are too;
 *  - on a §6 body they're attached with `lenient()`: a new field that doesn't match is dropped
 *    (and reported by fetch-data as a warning) instead of taking the whole agent down to sample
 *    data. The strict schemas are exported in `AGENTIC_FIELDS` for that check.
 * The site-side reading of these shapes is documented in docs/specs/AGENTIC_ADDITIONS.md.
 */

/** Optional field that becomes `undefined` when present but malformed (never fails the parent). */
export function lenient<T extends z.ZodTypeAny>(schema: T) {
  return schema.optional().catch(undefined) as unknown as z.ZodOptional<T>;
}

/**
 * Optional array whose malformed items are dropped one by one (the rest still show). A value
 * that isn't an array at all becomes `undefined`.
 */
export function lenientArray<T extends z.ZodTypeAny>(item: T) {
  return z
    .array(z.unknown())
    .transform((xs) =>
      xs.flatMap((x) => {
        const r = item.safeParse(x);
        return r.success ? [r.data as z.output<T>] : [];
      }),
    )
    .optional()
    .catch(undefined);
}

/**
 * Citation in either the site's `{ name, url }` or agents-core's `{ source, url }` spelling,
 * normalized to `{ name, url, note }`.
 */
export const looseCitation = z
  .object({
    name: z.string().optional(),
    source: z.string().optional(),
    title: z.string().optional(),
    url: z.string().url(),
    note: z.string().nullable().optional(),
  })
  .transform((c) => ({
    name: c.name ?? c.title ?? c.source ?? new URL(c.url).hostname,
    url: c.url,
    note: c.note ?? null,
  }));
export type LooseCitation = z.infer<typeof looseCitation>;

/** A tool the loop called, as shown in an output's "tool calls" trail. */
export interface ToolStep {
  tool: string;
  summary?: string | null;
  is_error?: boolean;
}

// ---- trace.json (agents-core `schema.Trace`) -------------------------------------------

export const traceSummary = z.object({
  steps: z.number().int().nonnegative().default(0),
  tool_calls: z.number().int().nonnegative().default(0),
  llm_calls: z.number().int().nonnegative().default(0),
  total_latency_ms: z.number().nonnegative().default(0),
  cost_usd: z.number().nonnegative().default(0),
  guard_retries: z.number().int().nonnegative().default(0),
});
export type TraceSummary = z.infer<typeof traceSummary>;

export const spanKind = z.enum(['run', 'phase', 'agent_loop', 'llm_call', 'tool_call', 'http', 'guard', 'custom']);
export type SpanKind = z.infer<typeof spanKind>;

export const traceSpan = z.object({
  id: z.string(),
  parent_id: z.string().nullable(),
  // Unknown future kinds are shown as "custom" rather than rejecting the trace.
  kind: z.union([spanKind, z.string()]).transform((k): SpanKind => (spanKind.safeParse(k).success ? (k as SpanKind) : 'custom')),
  name: z.string(),
  started_at: z.string().datetime({ offset: true }),
  duration_ms: z.number().nullable(),
  status: z.enum(['ok', 'error']).default('ok'),
  error: z.string().nullable().optional(),
  attrs: z.record(z.unknown()).default({}),
});
export type TraceSpan = z.infer<typeof traceSpan>;

export const trace = z.object({
  trace_schema_version: z.string().regex(/^1\.\d+\.\d+$/, 'expected trace schema 1.x').default('1.0.0'),
  agent: z.string(),
  run_id: z.string(),
  summary: traceSummary,
  spans: z.array(traceSpan),
  truncated: z.boolean().default(false),
  dropped_spans: z.number().int().nonnegative().default(0),
});
export type Trace = z.infer<typeof trace>;

// ---- evals/history.jsonl (agents-core `EvalReport.history_entry`) ------------------------

/**
 * One line of an agent repo's `evals/history.jsonl`. agents-core writes `ts`, `suite`, `scores`
 * (0..1), `pass_rate`, `usd`; older/hand-rolled harnesses (agents-mcp) write `date` and
 * `cost_usd`. Normalized to one shape; non-0..1 "scores" (counts like `n`) are moved to `counts`.
 */
export const evalHistoryLine = z
  .object({
    ts: z.string().optional(),
    date: z.string().optional(),
    suite: z.string().optional(),
    prompt_version: z.string().nullable().optional(),
    git_sha: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    scores: z.record(z.number().nullable()).default({}),
    pass_rate: z.number().min(0).max(1).nullable().optional(),
    usd: z.number().nullable().optional(),
    cost_usd: z.number().nullable().optional(),
    n_cases: z.number().int().nullable().optional(),
    n_scored: z.number().int().nullable().optional(),
    budget_exhausted: z.boolean().optional(),
  })
  .refine((l) => l.ts ?? l.date, 'expected `ts` or `date`')
  .refine((l) => !Number.isNaN(Date.parse((l.ts ?? l.date)!)), 'unparseable `ts`/`date`')
  .transform((l) => {
    const scores: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(l.scores)) {
      if (v == null) continue;
      if (v >= 0 && v <= 1) scores[k] = v;
      else counts[k] = v;
    }
    return {
      ts: new Date(Date.parse((l.ts ?? l.date)!)).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      suite: l.suite ?? 'default',
      prompt_version: l.prompt_version ?? null,
      git_sha: l.git_sha ?? null,
      model: l.model ?? null,
      scores,
      counts,
      pass_rate: l.pass_rate ?? null,
      usd: l.usd ?? l.cost_usd ?? null,
      n_cases: l.n_cases ?? (typeof counts.n === 'number' ? counts.n : null),
      budget_exhausted: l.budget_exhausted ?? false,
    };
  });
export type EvalHistoryEntry = z.infer<typeof evalHistoryLine>;

/** Already-normalized entry, as written by fetch-data (validated again by the site). */
export const evalEntry = z.object({
  ts: z.string().datetime({ offset: true }),
  suite: z.string(),
  prompt_version: z.string().nullable(),
  git_sha: z.string().nullable(),
  model: z.string().nullable(),
  scores: z.record(z.number().min(0).max(1)),
  counts: z.record(z.number()).default({}),
  pass_rate: z.number().min(0).max(1).nullable(),
  usd: z.number().nullable(),
  n_cases: z.number().nullable(),
  budget_exhausted: z.boolean().default(false),
});
export type EvalEntry = z.infer<typeof evalEntry>;

/** Site-assembled `public/data/evals/<id>.json` (scripts/fetch-data.mjs). */
export const evalsData = z.object({
  id: z.string(),
  name: z.string(),
  repo: z.string(),
  source_url: z.string().url(),
  sample: z.boolean(),
  reason: z.string().nullable().optional(),
  skipped_lines: z.number().int().nonnegative().default(0),
  entries: z.array(evalEntry),
});
export type EvalsData = z.infer<typeof evalsData>;

// ---- case studies ---------------------------------------------------------------------

export const caseStudiesIndex = z.object({
  generated_at: z.string().datetime({ offset: true }),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      repo: z.string(),
      source_url: z.string().url(),
      file: z.string(),
      sample: z.boolean(),
      reason: z.string().nullable().optional(),
    }),
  ),
});
export type CaseStudiesIndex = z.infer<typeof caseStudiesIndex>;

// ---- real estate: metro investigations (SPEC_REAL_ESTATE §6.3, published by real-estate-agent) --

/** `new_major_flag` | `top_mover` (unknown future triggers are kept as text). */
const reTrigger = z.string();

/** real-estate-agent `InvestigationSummary`: one entry of `latest.json` → `investigations`. */
export const investigationSummary = z.object({
  slug: z.string(),
  name: z.string(),
  trigger: reTrigger,
  trigger_label: z.string(),
  /** The explanation's first sentence (≤ 240 chars). */
  summary: z.string(),
  cited_metrics: z.array(z.string()).default([]),
  narrative_source: narrativeSource,
  stop_reason: z.string(),
});
export type InvestigationSummary = z.infer<typeof investigationSummary>;

/** real-estate-agent `Investigation`: `metros/<slug>.json` → `investigation` (null when not investigated). */
export const investigation = z.object({
  slug: z.string(),
  name: z.string(),
  trigger: reTrigger,
  trigger_flag: z.string().nullable().optional(),
  trigger_label: z.string(),
  /** 4–6 sentences, number-guarded. */
  explanation: z.string(),
  cited_metrics: z.array(z.string()).default([]),
  narrative_source: narrativeSource,
  model: z.string().nullable().optional(),
  /** agents-core LoopResult.stop_reason, or `not_run`. */
  stop_reason: z.string(),
  steps: z.number().int().nonnegative(),
  tools_called: z.array(z.string()).default([]),
  cost_usd: z.number().nonnegative(),
  prompt_version: z.string().nullable().optional(),
  generated_at: z.string(),
  reused: z.boolean().default(false),
});
export type Investigation = z.infer<typeof investigation>;

// ---- macro: release investigation, "what's driving this" (SPEC_MACRO §6.1) -----------

/** fed-agent `Investigation` (schema 1.1.0), from its exported schema.json. */
export const macroInvestigation = z.object({
  trigger: z.object({
    event_id: z.string(),
    type: z.string(),
    indicator_id: z.string().nullable().optional(),
  }),
  /** 2–4 sentences, ≤ 120 words, number-guarded. */
  analysis: z.string(),
  /** Series a tool actually returned this run (attached by code). */
  cited_series: z
    .array(z.object({ id: z.string(), name: z.string(), fred_series: z.string(), url: z.string().url() }))
    .default([]),
  narrative_source: narrativeSource,
  model: z.string().nullable().optional(),
  generated_at: z.string(),
  reused_from_run_id: z.string().nullable().optional(),
  loop: z
    .object({
      steps: z.number().int().nonnegative(),
      tool_calls: z.array(z.string()).default([]),
      stop_reason: z.string(),
      cost_usd: z.number().nonnegative(),
      guard_attempts: z.number().int().nonnegative().default(0),
    })
    .nullable()
    .optional(),
});
export type MacroInvestigation = z.infer<typeof macroInvestigation>;

// ---- grants: bid research (SPEC_GRANTS §6.3, published by sam-agent) --------------------

/** sam-agent `PriorAward`: copied from USAspending in code, never by the model. */
export const priorAward = z.object({
  award_id: z.string(),
  recipient: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  start_date: isoDate.nullable().optional().catch(null),
  end_date: isoDate.nullable().optional().catch(null),
  awarding_agency: z.string().nullable().optional(),
  url: z.string().url(),
});
export type PriorAward = z.infer<typeof priorAward>;

/** sam-agent `ResearchBlock` on `top_matches[i].research` (schema 1.1.0). */
export const grantsResearch = z.object({
  status: z.enum(['complete', 'partial']).catch('partial'),
  stop_reason: z.string().nullable().optional(),
  narrative_source: narrativeSource,
  what_theyre_buying: z.string(),
  evaluation_criteria: z.array(z.string()).default([]),
  likely_incumbent: z.string().nullable().optional(),
  incumbent_notes: z.string().nullable().optional(),
  prior_awards: z.array(priorAward).default([]),
  risks: z.array(z.string()).default([]),
  go_no_go: z.enum(['go', 'no_go']),
  rationale: z.string(),
  citations: z.array(looseCitation).default([]),
  tools_used: z.array(z.string()).default([]),
  steps: z.number().int().nonnegative().nullable().optional(),
  cost_usd: z.number().nonnegative().nullable().optional(),
  model: z.string().nullable().optional(),
  prompt_version: z.string().nullable().optional(),
  researched_at: z.string().nullable().optional(),
});
export type GrantsResearch = z.infer<typeof grantsResearch>;

// ---- repos: fix proposals (SPEC_REPO_MAINT §6.1, published by repo-maintain-agent) -------

/** repo-maintain-agent `repos[i].fix_proposals[]` (schema 1.1.0). */
export const fixProposal = z.object({
  /** 12 hex digits; what a human approves (bound to the exact diff). */
  id: z.string(),
  issue_number: z.number().int(),
  issue_url: z.string().url().nullable().optional(),
  issue_title: z.string().nullable().optional(),
  /** proposed · no_fix · stopped · approval_blocked · pr_opened · failed (unknown values shown verbatim). */
  status: z.string(),
  reason: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  rationale: z.string().nullable().optional(),
  narrative_source: narrativeSource.nullable().optional(),
  diff: z.string().nullable().optional(),
  files_changed: z.array(z.string()).default([]),
  lines_added: z.number().int().nonnegative().default(0),
  lines_removed: z.number().int().nonnegative().default(0),
  pr_url: z.string().url().nullable().optional(),
  loop: z
    .object({
      steps: z.number().int().nonnegative(),
      stop_reason: z.string(),
      usd: z.number().nonnegative(),
      tools_called: z.array(z.string()).default([]),
    })
    .nullable()
    .optional(),
  model: z.string().nullable().optional(),
  proposed_at: z.string().nullable().optional(),
});
export type FixProposal = z.infer<typeof fixProposal>;

/**
 * Strict versions of the new optional fields on each §6 body, keyed by agent → file → field.
 * fetch-data validates these separately and logs a warning when one is malformed (the page then
 * simply doesn't show that field, see `lenient`).
 */
export const AGENTIC_FIELDS = {
  real_estate: {
    'latest.json': { investigations: z.array(investigationSummary) },
    'metros/*.json': { investigation: investigation.nullable() },
  },
  macro: { 'latest.json': { investigation: macroInvestigation.nullable() } },
  grants: { 'latest.json': { 'top_matches[].research': grantsResearch.nullable() } },
  repo_maint: { 'latest.json': { 'repos[].fix_proposals': z.array(fixProposal) } },
} as const;
