import { z } from 'zod';
import { citation, goodDirection, isoDate, keyStat, narrativeSource, runMeta, statFormat, timestamp } from './common';

/** SPEC_REAL_ESTATE §6. */

const num = z.number().nullable();

/**
 * TODO(real-estate-agent): for `change_kind: diff` metrics it publishes `delta_format:
 * "<unit>_signed"` (`days_signed`, `months_signed`, `diff_signed`), which is outside the shared
 * agents-core `StatFormat` vocabulary. Read the known ones as their StatFormat equivalent and any
 * other `*_signed` as null (the site then formats from the metric registry). See STATUS.md
 * "Agent-side fixes needed".
 */
const DIFF_FORMAT_ALIASES: Record<string, z.infer<typeof statFormat>> = {
  days_signed: 'days',
  months_signed: 'decimal1',
};
const metricDeltaFormat = z
  .union([statFormat, z.string().regex(/^[a-z]+_signed$/, 'expected a StatFormat')])
  .transform((v): z.infer<typeof statFormat> | null => {
    const known = statFormat.safeParse(v);
    return known.success ? known.data : (DIFF_FORMAT_ALIASES[v] ?? null);
  });
const trend = z.enum(['up', 'down', 'flat']).nullable().optional();

export const metricValue = z.object({
  value: num,
  yoy: num.optional(),
  yoy_12m: num.optional(),
  mom: num.optional(),
  delta_format: metricDeltaFormat.nullable().optional(),
  trend_3m: trend,
  high_36m: z.boolean().nullable().optional(),
  low_36m: z.boolean().nullable().optional(),
  pct_rank: num.optional(),
  yoy_pct_rank: num.optional(),
});
export type MetricValue = z.infer<typeof metricValue>;

export const metricRegistryEntry = z.object({
  key: z.string(),
  label: z.string(),
  format: statFormat,
  change_kind: z.enum(['ratio', 'pp', 'diff']),
  good_direction: goodDirection,
  source: z.string(),
  note: z.string().nullable().optional(),
});
export type MetricRegistryEntry = z.infer<typeof metricRegistryEntry>;

export const temperatureLabel = z.enum(['Hot', 'Warm', 'Balanced', 'Cool', 'Cold']);
export const marketType = z.enum(["Seller's market", 'Balanced', "Buyer's market"]);

export const brief = z.object({
  text: z.string(),
  key_points: z.array(z.string()).default([]),
  citations: z.array(citation).default([]),
  narrative_source: narrativeSource,
  model: z.string().nullable().optional(),
  generated_at: timestamp,
  reused: z.boolean().optional(),
});
export type Brief = z.infer<typeof brief>;

/** Series block: one shared `dates` array plus one nullable array per metric. */
const seriesBlock = z
  .object({ dates: z.array(isoDate) })
  .catchall(z.array(z.number().nullable()))
  .superRefine((s, ctx) => {
    for (const [k, v] of Object.entries(s)) {
      if (k !== 'dates' && Array.isArray(v) && v.length !== s.dates.length) {
        ctx.addIssue({ code: 'custom', path: [k], message: `length ${v.length} ≠ dates length ${s.dates.length}` });
      }
    }
  });
export type SeriesBlock = { dates: string[] } & Record<string, (number | null)[]>;

export const metroSummary = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  cbsa: z.string().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  homes_sold_12m: z.number().int().nullable().optional(),
  latest: z.record(metricValue),
  temperature: z.object({ score: num, label: temperatureLabel.nullable() }),
  market_type: marketType.nullable(),
  flags: z.array(z.string()),
  brief_excerpt: z.string().default(''),
});
export type MetroSummary = z.infer<typeof metroSummary>;

const mover = z.object({ slug: z.string(), name: z.string(), value: z.number() });
export type Mover = z.infer<typeof mover>;

const constructionValue = z.object({
  value: num,
  mom: num.optional(),
  units: z.string().nullable().optional(),
  period: isoDate.nullable().optional(),
});

export const realEstateLatest = z.object({
  meta: runMeta,
  headline: z.string(),
  key_stats: z.array(keyStat),
  data_through: isoDate,
  rates_as_of: isoDate,
  metric_registry: z.array(metricRegistryEntry).min(1),
  national: z.object({
    latest: z.record(metricValue),
    temperature: z.object({ score: num, label: temperatureLabel.nullable(), basis: z.string().optional() }),
    series: seriesBlock,
    rates: z.object({
      dates: z.array(isoDate),
      mortgage30: z.array(z.number().nullable()),
      mortgage15: z.array(z.number().nullable()),
      latest: z.object({
        mortgage30: num,
        mortgage30_change_1w_pp: num,
        mortgage30_year_ago: num,
      }),
    }),
    construction: z.object({
      housing_starts: constructionValue,
      permits: constructionValue,
      series: seriesBlock,
    }),
    case_shiller: z.object({ value: num, yoy: num.optional(), period: isoDate.nullable().optional() }),
    brief,
  }),
  metros: z.array(metroSummary).min(1),
  movers: z.object({
    price_gains: z.array(mover),
    price_declines: z.array(mover),
    inventory_growth: z.array(mover),
  }),
  alerts: z.array(
    z.object({
      flag: z.string(),
      label: z.string(),
      severity: z.enum(['info', 'notable', 'major']),
      slugs: z.array(z.string()),
    }),
  ),
  sources: z.array(citation),
});
export type RealEstateLatest = z.infer<typeof realEstateLatest>;

export const metroFlag = z.object({
  id: z.string(),
  label: z.string(),
  severity: z.enum(['info', 'notable', 'major']),
  facts: z.record(z.union([z.number(), z.string(), z.boolean(), z.null()])).default({}),
});
export type MetroFlag = z.infer<typeof metroFlag>;

export const metroDetail = z.object({
  slug: z.string(),
  name: z.string(),
  cbsa: z.string().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  data_through: isoDate,
  latest: z.record(metricValue),
  temperature: z.object({
    score: num,
    label: temperatureLabel.nullable(),
    components: z.record(z.number().nullable()).default({}),
  }),
  market_type: marketType.nullable(),
  flags: z.array(metroFlag),
  affordability: z.object({
    median_household_income: num,
    income_year: z.number().int().nullable(),
    payment_now: num,
    payment_year_ago: num,
    payment_change_pct: num,
    payment_to_income: num,
    assumptions: z.object({
      down_payment_pct: z.number(),
      term_years: z.number().int(),
      rate_now: num,
      rate_year_ago: num,
      price_year_ago: num,
    }),
  }),
  series: seriesBlock,
  brief,
});
export type MetroDetail = z.infer<typeof metroDetail>;
