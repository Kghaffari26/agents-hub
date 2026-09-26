import { z } from 'zod';
import { goodDirection, isoDate, keyStat, narrativeSource, runMeta, timestamp } from './common';

/** SPEC_GRANTS §6. */

export const recommendation = z.enum(['Pursue', 'Consider', 'Pass']);
export type Recommendation = z.infer<typeof recommendation>;
const source = z.enum(['sam', 'grants_gov']);

export const subScores = z.object({
  capability: z.number(),
  eligibility: z.number(),
  size: z.number(),
  timeline: z.number(),
  strategic: z.number(),
});
export type SubScores = z.infer<typeof subScores>;

export const topMatch = z.object({
  id: z.string(),
  source,
  kind: z.enum(['contract', 'grant']),
  notice_type: z.string(),
  notice_type_label: z.string(),
  title: z.string(),
  solicitation_number: z.string().nullable().optional(),
  agency: z.string(),
  office: z.string().nullable().optional(),
  naics: z.array(z.string()),
  psc: z.string().nullable().optional(),
  set_aside_label: z.string().nullable().optional(),
  posted_date: isoDate,
  deadline: z.string().datetime({ offset: true }).nullable(),
  days_left: z.number().int().nullable(),
  place: z.string().nullable().optional(),
  value: z.object({
    kind: z.string(),
    amount: z.number().nullable(),
    floor: z.number().nullable().optional(),
  }),
  url: z.string().url(),
  fit: z.number().min(0).max(100),
  sub_scores: subScores,
  recommendation,
  confidence: z.enum(['low', 'medium', 'high']),
  reasons: z.array(z.string()),
  red_flags: z.array(z.string()),
  is_new: z.boolean(),
  changed: z.boolean(),
  summary: z
    .object({
      what_they_want: z.string(),
      why_fit: z.array(z.string()),
      risks: z.array(z.string()),
      next_steps: z.array(z.string()),
      narrative_source: narrativeSource,
      model: z.string().nullable().optional(),
      generated_at: timestamp,
    })
    .nullable(),
});
export type TopMatch = z.infer<typeof topMatch>;

export const grantsLatest = z.object({
  meta: runMeta.extend({
    sam_budget_exhausted: z.boolean().optional(),
    sam_requests_used: z.number().int().optional(),
  }),
  headline: z.string(),
  key_stats: z.array(keyStat.extend({ good_direction: goodDirection.nullable().optional() })),
  profile: z.object({
    id: z.string(),
    name: z.string(),
    naics: z.array(z.string()),
    set_asides_eligible: z.array(z.string()),
    keywords_preview: z.array(z.string()),
    profile_hash: z.string(),
  }),
  thresholds: z.object({ relevance: z.number(), pursue: z.number(), consider: z.number() }),
  stats: z.object({
    new_since_last_run: z.number().int(),
    closing_within_14d: z.number().int(),
    active_matches: z.number().int(),
    largest_value: z.object({ amount: z.number(), id: z.string(), title: z.string() }).nullable(),
    fetched: z.record(z.number().int()),
    rejected: z.record(z.number().int()),
    below_relevance: z.number().int(),
    llm_scored_this_run: z.number().int(),
    llm_scored_cached: z.number().int(),
  }),
  top_matches: z.array(topMatch),
  deadlines_30d: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      deadline: z.string().datetime({ offset: true }),
      recommendation,
      fit: z.number(),
    }),
  ),
  sources: z.array(z.object({ name: z.string(), url: z.string().url() })),
  disclaimer: z.string(),
});
export type GrantsLatest = z.infer<typeof grantsLatest>;

export const grantsRow = z.object({
  id: z.string(),
  source,
  kind: z.enum(['contract', 'grant']),
  type: z.string(),
  title: z.string(),
  agency: z.string(),
  naics: z.array(z.string()),
  set_aside: z.string().nullable(),
  posted: isoDate,
  deadline: z.string().datetime({ offset: true }).nullable(),
  value: z.number().nullable(),
  fit: z.number().nullable(),
  relevance: z.number(),
  recommendation: recommendation.nullable(),
  reasons: z.array(z.string()),
  url: z.string().url(),
  is_new: z.boolean(),
  in_top: z.boolean(),
});
export type GrantsRow = z.infer<typeof grantsRow>;

export const grantsAll = z.object({
  generated_at: timestamp,
  rows: z.array(grantsRow).max(2000),
});
export type GrantsAll = z.infer<typeof grantsAll>;
