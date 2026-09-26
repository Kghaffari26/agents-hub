import type { MetroDetail, MetroSummary, RealEstateLatest } from '@/lib/schemas/realEstate';
import { RANGE_MONTHS, US, type Range } from '@/lib/urlState';
import type { ResolvedMetric } from '@/lib/metrics';
import { formatDelta, formatMonth } from '@/lib/format';

export const US_LABEL = 'United States';

/** Default compare: #1 metro by homes sold + the top price mover (SPEC_WEBSITE §7.2). */
export function defaultSelection(index: Pick<RealEstateLatest, 'metros' | 'movers'>): string[] {
  const bySold = [...index.metros].sort((a, b) => (b.homes_sold_12m ?? 0) - (a.homes_sold_12m ?? 0));
  const out: string[] = [];
  if (bySold[0]) out.push(bySold[0].slug);
  const mover = index.movers.price_gains[0]?.slug;
  if (mover && !out.includes(mover)) out.push(mover);
  return out;
}

export function metroName(slug: string, metros: MetroSummary[]): string {
  if (slug === US) return US_LABEL;
  return metros.find((m) => m.slug === slug)?.name ?? slug;
}

export const shortName = (name: string) => name.split(',')[0];

type Series = { dates: string[] } & Record<string, (number | null)[]>;

/** Series source for a selection entry: a metro detail file, or the national series for "us". */
export function seriesFor(
  slug: string,
  details: Record<string, MetroDetail | undefined>,
  national: Series,
): Series | undefined {
  return slug === US ? national : details[slug]?.series;
}

export interface ChartRow {
  date: string;
  rate?: number | null;
  [slug: string]: number | string | null | undefined;
}

/** Month-end mortgage rate: the last weekly reading in each month. */
export function monthlyRates(dates: string[], values: (number | null)[]): Map<string, number | null> {
  const m = new Map<string, number | null>();
  dates.forEach((d, i) => {
    if (values[i] != null) m.set(d.slice(0, 7), values[i]);
  });
  return m;
}

export function buildChartRows(
  slugs: string[],
  metric: string,
  range: Range,
  details: Record<string, MetroDetail | undefined>,
  national: Series,
  rates?: Map<string, number | null>,
): ChartRow[] {
  const months = RANGE_MONTHS[range];
  const byDate = new Map<string, ChartRow>();
  for (const slug of slugs) {
    const s = seriesFor(slug, details, national);
    if (!s) continue;
    const vals = s[metric];
    const start = Math.max(0, s.dates.length - months);
    for (let i = start; i < s.dates.length; i++) {
      const d = s.dates[i];
      const row = byDate.get(d) ?? { date: d };
      row[slug] = vals ? (vals[i] ?? null) : null;
      byDate.set(d, row);
    }
  }
  const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (rates) for (const r of rows) r.rate = rates.get(r.date.slice(0, 7)) ?? null;
  // Every selected line has a key on every row so gaps render as breaks, not zeros.
  for (const r of rows) for (const s of slugs) if (!(s in r)) r[s] = null;
  return rows;
}

/** First→last change over the plotted window, in the metric's change terms. */
export function windowChange(
  rows: ChartRow[],
  slug: string,
  metric: Pick<ResolvedMetric, 'changeKind'>,
): number | null {
  const vals = rows.map((r) => r[slug]).filter((v): v is number => typeof v === 'number');
  if (vals.length < 2) return null;
  const a = vals[0];
  const b = vals[vals.length - 1];
  if (metric.changeKind === 'ratio') return a ? b / a - 1 : null;
  return b - a;
}

/** "Median sale price, Austin vs Denver, last 2 years; Austin down 3.1%, Denver up 1.4%" */
export function chartSummary(
  rows: ChartRow[],
  slugs: string[],
  names: Record<string, string>,
  metric: ResolvedMetric,
  range: Range,
  deltaFormat: Parameters<typeof formatDelta>[1],
): string {
  const years = RANGE_MONTHS[range] / 12;
  const who = slugs.map((s) => shortName(names[s] ?? s)).join(' vs ');
  const parts = slugs.map((s) => {
    const c = windowChange(rows, s, metric);
    if (c == null) return `${shortName(names[s] ?? s)} no data`;
    const word = c > 0 ? 'up' : c < 0 ? 'down' : 'unchanged';
    const abs = formatDelta(Math.abs(c), deltaFormat, { isRatio: metric.changeKind === 'pp' }).replace(
      /^[+−-]/,
      '',
    );
    return `${shortName(names[s] ?? s)} ${word}${c !== 0 ? ` ${abs}` : ''}`;
  });
  const span = rows.length
    ? `${formatMonth(rows[0].date)} to ${formatMonth(rows[rows.length - 1].date)}`
    : '';
  return `${metric.label}, ${who}, last ${years} year${years > 1 ? 's' : ''} (${span}); ${parts.join(', ')}.`;
}

export const LINE_COLORS = ['chart-1', 'chart-2', 'chart-3'] as const;
