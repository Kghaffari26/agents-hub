import type { GoodDirection, StatFormat } from '@/lib/schemas/common';
import type { Indicator, MacroLatest } from '@/lib/schemas/macro';
import { DASH, formatDelta, formatValue, parseDate } from '@/lib/format';

/** An indicator as passed from the server page to client components: no 10-year `series`. */
export type IndicatorLite = Omit<Indicator, 'series'>;

export type MacroFomc = MacroLatest['fomc'];
export type FomcLatest = NonNullable<MacroFomc['latest']>;
export type YieldCurveData = MacroLatest['yield_curve'];

export function stripSeries(i: Indicator): IndicatorLite {
  const out: Partial<Indicator> = { ...i };
  delete out.series;
  return out as IndicatorLite;
}

export const GROUPS: { id: Indicator['group']; label: string }[] = [
  { id: 'inflation', label: 'Inflation' },
  { id: 'labor', label: 'Labor' },
  { id: 'growth', label: 'Growth' },
  { id: 'rates', label: 'Rates' },
  { id: 'sentiment', label: 'Sentiment' },
];

/**
 * The macro agent publishes `percent_signed` values already in percent units (MoM 0.3 = +0.3%),
 * while the shared formatter treats `percent_signed` as a ratio (0.003 = +0.3%). Scale here.
 */
export function scaleForFormat(x: number | null | undefined, format: StatFormat | null | undefined) {
  if (x == null || !Number.isFinite(x)) return x;
  return format === 'percent_signed' ? x / 100 : x;
}

export function fmtValue(x: number | null | undefined, format: StatFormat | null | undefined): string {
  return formatValue(scaleForFormat(x, format), format);
}

export function fmtDelta(x: number | null | undefined, format: StatFormat | null | undefined): string {
  return formatDelta(scaleForFormat(x, format), format);
}

/** "Jul revised: +73K → +41K" (falls back to 2 decimals when both round to the same text). */
export function revisionText(rev: NonNullable<Indicator['revision']>): string {
  const month = rev.period_label.split(/\s+/)[0] || rev.period_label;
  let a = fmtValue(rev.old, rev.format);
  let b = fmtValue(rev.new, rev.format);
  if (a === b && rev.format === 'decimal1') {
    a = rev.old.toFixed(2);
    b = rev.new.toFixed(2);
  }
  return `${month} revised: ${a} → ${b}`;
}

/** "4.00–4.25%" */
export function targetRange(r: { lower: number; upper: number } | null | undefined): string {
  if (!r) return DASH;
  return `${r.lower.toFixed(2)}–${r.upper.toFixed(2)}%`;
}

/** "−25 bp", "+25 bp", "No change" */
export function bpChange(bp: number | null | undefined): string {
  if (bp == null) return DASH;
  if (bp === 0) return 'No change';
  return `${bp > 0 ? '+' : '−'}${Math.abs(bp)} bp`;
}

export const DECISION_WORD = { cut: 'Cut', hold: 'Hold', hike: 'Hike' } as const;

export const TONE_LABEL = {
  more_hawkish: 'More hawkish',
  unchanged: 'Unchanged',
  more_dovish: 'More dovish',
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Oct 27–28" or "Oct 31–Nov 1" */
export function meetingRange(start: string, end: string): string {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s) return DASH;
  const sm = MONTHS[s.getUTCMonth()];
  if (!e || start === end) return `${sm} ${s.getUTCDate()}`;
  const em = MONTHS[e.getUTCMonth()];
  return sm === em
    ? `${sm} ${s.getUTCDate()}–${e.getUTCDate()}`
    : `${sm} ${s.getUTCDate()}–${em} ${e.getUTCDate()}`;
}

/** "Fri, Sep 26" */
export function weekdayDate(iso: string): string {
  const d = parseDate(iso);
  if (!d) return DASH;
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Sep ’24" axis tick */
export function tickMonth(d: string): string {
  return `${MONTHS[Number(d.slice(5, 7)) - 1] ?? ''} ’${d.slice(2, 4)}`;
}

/** Today's calendar date (UTC) as YYYY-MM-DD. */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  if (!d) return iso;
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}

/** Compact axis ticks by the indicator's primary format. */
export function axisTick(v: number, format: StatFormat): string {
  switch (format) {
    case 'percent':
      return `${Number(v.toFixed(2))}%`;
    case 'percent_signed':
      return `${v > 0 ? '+' : ''}${Number(v.toFixed(2))}%`;
    case 'pp_signed':
      return `${v > 0 ? '+' : ''}${Number(v.toFixed(2))}`;
    case 'count':
    case 'count_signed':
      return Math.abs(v) >= 1e3 ? `${Number((v / 1e3).toFixed(0))}K` : String(Math.round(v));
    case 'count_signed_thousands':
      return Math.abs(v) >= 1e3 ? `${Number((v / 1e3).toFixed(1))}M` : `${Math.round(v)}K`;
    default:
      return String(Number(v.toFixed(2)));
  }
}

export type Direction = GoodDirection | null | undefined;

export const RANGES = [
  { id: '2y', label: '2Y', years: 2 },
  { id: '5y', label: '5Y', years: 5 },
  { id: '10y', label: '10Y', years: 10 },
] as const;
export type RangeId = (typeof RANGES)[number]['id'];

/** Keep rows whose date is within `years` of the last date. */
export function sliceByYears<T extends { date: string }>(rows: T[], years: number): T[] {
  const last = rows.at(-1)?.date;
  if (!last) return rows;
  const cutoff = `${Number(last.slice(0, 4)) - years}${last.slice(4)}`;
  return rows.filter((r) => r.date > cutoff);
}
