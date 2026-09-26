/** Real-estate explorer URL state (SPEC_WEBSITE §7.2): ?m=a,b&metric=inventory&range=2y&rate=1 */

export const RANGES = ['1y', '2y', '3y'] as const;
export type Range = (typeof RANGES)[number];
export const MAX_COMPARE = 3;
export const US = 'us';

export interface ExplorerState {
  metros: string[];
  metric: string;
  range: Range;
  rate: boolean;
}

export interface ParseContext {
  knownSlugs: Set<string>;
  metricKeys: string[];
  defaults: ExplorerState;
}

type Params = { get(name: string): string | null };

/** Defensive parse: unknown slugs dropped, duplicates removed, invalid values → defaults. */
export function parseExplorerState(params: Params, ctx: ParseContext): ExplorerState {
  const rawM = params.get('m');
  let metros: string[];
  if (rawM == null) {
    metros = ctx.defaults.metros;
  } else if (rawM.trim() === '') {
    metros = []; // explicitly cleared by the user
  } else {
    const seen = new Set<string>();
    metros = rawM
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => (s === US || ctx.knownSlugs.has(s)) && !seen.has(s) && (seen.add(s), true))
      .slice(0, MAX_COMPARE);
    if (!metros.length) metros = ctx.defaults.metros;
  }
  const metric = params.get('metric');
  const range = params.get('range');
  const rate = params.get('rate');
  return {
    metros,
    metric: metric && ctx.metricKeys.includes(metric) ? metric : ctx.defaults.metric,
    range: (RANGES as readonly string[]).includes(range ?? '') ? (range as Range) : ctx.defaults.range,
    rate: rate == null ? ctx.defaults.rate : rate === '1' || rate === 'true',
  };
}

export function serializeExplorerState(s: ExplorerState): string {
  const p = new URLSearchParams();
  p.set('m', s.metros.join(','));
  p.set('metric', s.metric);
  p.set('range', s.range);
  if (s.rate) p.set('rate', '1');
  // Keep commas readable in shared links.
  return p.toString().replace(/%2C/gi, ',');
}

/** Add a metro; when full, replace the oldest (SPEC_WEBSITE §7.2 map click). */
export function addMetro(list: string[], slug: string, max = MAX_COMPARE): string[] {
  if (list.includes(slug)) return list;
  const next = [...list, slug];
  return next.length > max ? next.slice(next.length - max) : next;
}

export function removeMetro(list: string[], slug: string): string[] {
  return list.filter((s) => s !== slug);
}

export const RANGE_MONTHS: Record<Range, number> = { '1y': 12, '2y': 24, '3y': 36 };
