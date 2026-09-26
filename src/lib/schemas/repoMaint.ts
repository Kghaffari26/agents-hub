import { z } from 'zod';
import { keyStat, narrativeSource, runMeta, timestamp } from './common';

/** SPEC_REPO_MAINT §6. */

const ciState = z.enum(['success', 'failure', 'pending', 'none']);

export const triageItem = z.object({
  number: z.number().int(),
  title: z.string(),
  url: z.string().url(),
  author: z.string(),
  created_at: timestamp,
  classification: z.string(),
  priority: z.string().nullable(),
  confidence: z.enum(['low', 'medium', 'high']),
  suggested_labels: z.array(z.string()),
  missing_info: z.array(z.string()),
  summary: z.string(),
  duplicates: z.array(
    z.object({
      number: z.number().int(),
      url: z.string().url(),
      title: z.string(),
      similarity: z.number().min(0).max(1),
      state: z.enum(['open', 'closed']),
    }),
  ),
  applied: z.object({ labels: z.array(z.string()), commented: z.boolean() }),
  cached: z.boolean(),
});
export type TriageItem = z.infer<typeof triageItem>;

export const stalePr = z.object({
  number: z.number().int(),
  title: z.string(),
  url: z.string().url(),
  author: z.string(),
  age_days: z.number(),
  last_activity_at: timestamp,
  review_state: z.enum(['none', 'review_requested', 'changes_requested', 'approved', 'commented']),
  ci_state: ciState,
  nudge: z.string(),
});
export type StalePr = z.infer<typeof stalePr>;

export const repo = z.object({
  full_name: z.string(),
  url: z.string().url(),
  role: z.enum(['own', 'sandbox', 'public_demo']),
  allow_apply: z.boolean(),
  partial: z.boolean(),
  health: z.object({
    score: z.number().min(0).max(100),
    grade: z.enum(['A', 'B', 'C', 'D', 'F']),
    breakdown: z.array(z.object({ reason: z.string(), points: z.number() })),
  }),
  counts: z.object({
    open_issues: z.number().int(),
    untriaged: z.number().int(),
    untriaged_over_7d: z.number().int(),
    open_prs: z.number().int(),
    stale_prs: z.number().int(),
    no_response_count: z.number().int(),
  }),
  median_first_response_hours: z.number().nullable(),
  ci_default_branch: ciState,
  days_since_release: z.number().nullable(),
  activity_12w: z.object({
    weeks: z.array(z.string()),
    opened: z.array(z.number()),
    closed: z.array(z.number()),
  }),
  triage: z.array(triageItem),
  stale_prs: z.array(stalePr),
  changelog: z
    .object({
      base_ref: z.string().nullable(),
      base_date: z.string().nullable(),
      source: z.enum(['pull_requests', 'commits']),
      item_count: z.number().int(),
      suggested_version: z.string().nullable(),
      markdown: z.string(),
      narrative_source: narrativeSource,
      model: z.string().nullable().optional(),
      generated_at: timestamp,
      cached: z.boolean(),
    })
    .nullable(),
});
export type Repo = z.infer<typeof repo>;

export const action = z.object({
  repo: z.string(),
  type: z.string(),
  target: z.number().int().nullable(),
  detail: z.union([z.string(), z.array(z.string())]).nullable(),
  status: z.enum(['planned', 'applied', 'skipped']),
  reason: z.string().nullable(),
});
export type RepoAction = z.infer<typeof action>;

export const repoMaintLatest = z.object({
  meta: runMeta.extend({ github_requests: z.number().int().optional(), github_304s: z.number().int().optional() }),
  headline: z.string(),
  key_stats: z.array(keyStat),
  mode: z.enum(['report', 'apply']),
  repos: z.array(repo),
  actions: z.array(action),
});
export type RepoMaintLatest = z.infer<typeof repoMaintLatest>;
