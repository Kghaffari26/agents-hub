import { z } from 'zod';
import { lenient, macroInvestigation } from './agentic';
import { citation, columnar, goodDirection, isoDate, keyStat, narrativeSource, runMeta, statFormat, timestamp } from './common';

/** SPEC_MACRO §6. */

const valueBlock = z.object({
  label: z.string(),
  value: z.number().nullable(),
  format: statFormat,
  good_direction: goodDirection.nullable().optional(),
});
export type ValueBlock = z.infer<typeof valueBlock>;

const regime = z.object({ label: z.string(), detail: z.string() });
export type Regime = z.infer<typeof regime>;

export const indicator = z.object({
  id: z.string(),
  name: z.string(),
  group: z.enum(['inflation', 'labor', 'growth', 'rates', 'sentiment']),
  fred_series: z.string(),
  source_url: z.string().url(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  units_display: z.string(),
  primary: valueBlock,
  change: valueBlock.nullable(),
  secondary: z.array(valueBlock).default([]),
  period: isoDate,
  period_label: z.string(),
  released_at: isoDate.nullable(),
  next_release: isoDate.nullable(),
  delayed: z.boolean(),
  revision: z
    .object({
      period_label: z.string(),
      old: z.number(),
      new: z.number(),
      format: statFormat,
    })
    .nullable(),
  spark: columnar,
  series: columnar,
});
export type Indicator = z.infer<typeof indicator>;

export const fomcChange = z.object({
  idx: z.number().int().nonnegative(),
  type: z.enum(['added', 'removed', 'modified']),
  before: z.string().nullable().optional(),
  after: z.string().nullable().optional(),
});
export type FomcChange = z.infer<typeof fomcChange>;

export const macroLatest = z.object({
  meta: runMeta,
  headline: z.string(),
  key_stats: z.array(keyStat),
  regimes: z.object({
    inflation: regime,
    labor: regime,
    growth: regime,
    policy: regime,
    curve: regime,
  }),
  brief: z.object({
    bullets: z.array(
      z.object({
        text: z.string(),
        event_ids: z.array(z.string()).default([]),
        citations: z.array(citation).default([]),
      }),
    ),
    narrative_source: narrativeSource,
    model: z.string().nullable().optional(),
    generated_at: timestamp,
    reused_from_run_id: z.string().nullable().optional(),
  }),
  indicators: z.array(indicator).min(1),
  yield_curve: z.object({
    series: z.object({
      dates: z.array(isoDate),
      y2: z.array(z.number().nullable()),
      y10: z.array(z.number().nullable()),
      spread_10y2y: z.array(z.number().nullable()),
    }),
    inversion_periods: z.array(z.object({ start: isoDate, end: isoDate.nullable() })),
    snapshot: z.array(z.object({ tenor: z.string(), value: z.number().nullable() })),
  }),
  fomc: z.object({
    latest: z
      .object({
        date: isoDate,
        url: z.string().url(),
        decision: z.enum(['hold', 'cut', 'hike']),
        target_range: z.object({ lower: z.number(), upper: z.number() }),
        change_bp: z.number().int(),
        votes: z.object({
          for_count: z.number().int().nonnegative(),
          against: z.array(z.object({ name: z.string(), preferred: z.string().nullable().optional() })),
        }),
        latest_text: z.string(),
        previous_date: isoDate.nullable(),
        previous_text: z.string().nullable(),
        changes: z.array(fomcChange),
        read: z
          .object({
            summary: z.string(),
            tone_shift: z.enum(['more_hawkish', 'unchanged', 'more_dovish']),
            rationale: z.string(),
            cited_change_idx: z.array(z.number().int()).default([]),
            key_phrases: z.array(z.object({ phrase: z.string(), interpretation: z.string() })).default([]),
            narrative_source: narrativeSource,
          })
          .nullable(),
      })
      .nullable(),
    next_meeting: z.object({ start: isoDate, end: isoDate, has_sep: z.boolean() }).nullable(),
    minutes: z
      .object({
        meeting_date: isoDate,
        released_at: isoDate,
        url: z.string().url(),
        summary: z.string().nullable(),
        narrative_source: narrativeSource.nullable().optional(),
      })
      .nullable(),
  }),
  calendar: z.array(z.object({ date: isoDate, release: z.string(), indicator_ids: z.array(z.string()) })),
  events: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      priority: z.number(),
      facts: z.record(z.unknown()),
    }),
  ),
  /** §6.1 (schema 1.1.0): the release investigator's latest "what's driving this" analysis. */
  investigation: lenient(macroInvestigation.nullable()),
});
export type MacroLatest = z.infer<typeof macroLatest>;
