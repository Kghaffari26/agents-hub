import type { GoodDirection, StatFormat } from './schemas/common';
import type { MetricRegistryEntry, MetricValue } from './schemas/realEstate';

/**
 * Site-side metric definitions. The agent's `metric_registry` / `good_direction` wins;
 * these are the fallback (SPEC_WEBSITE §5 "Delta coloring is semantic").
 */
export interface MetricDef {
  key: string;
  label: string;
  short: string;
  format: StatFormat;
  changeKind: 'ratio' | 'pp' | 'diff';
  goodDirection: GoodDirection;
  definition: string;
}

export const METRICS: Record<string, MetricDef> = {
  median_sale_price: {
    key: 'median_sale_price',
    label: 'Median sale price',
    short: 'Price',
    format: 'currency',
    changeKind: 'ratio',
    goodDirection: 'neutral',
    definition:
      'Median price of homes sold during the month (Redfin). Not seasonally adjusted, so compare year over year.',
  },
  homes_sold: {
    key: 'homes_sold',
    label: 'Homes sold',
    short: 'Sold',
    format: 'count',
    changeKind: 'ratio',
    goodDirection: 'up',
    definition: 'Number of homes sold during the month (Redfin).',
  },
  new_listings: {
    key: 'new_listings',
    label: 'New listings',
    short: 'New listings',
    format: 'count',
    changeKind: 'ratio',
    goodDirection: 'neutral',
    definition: 'Homes newly listed for sale during the month (Redfin).',
  },
  inventory: {
    key: 'inventory',
    label: 'Active inventory',
    short: 'Inventory',
    format: 'count',
    changeKind: 'ratio',
    goodDirection: 'neutral',
    definition: 'Homes actively listed for sale at month end (Redfin).',
  },
  months_of_supply: {
    key: 'months_of_supply',
    label: 'Months of supply',
    short: 'Supply',
    format: 'decimal1',
    changeKind: 'diff',
    goodDirection: 'neutral',
    definition:
      'Months it would take to sell current inventory at the current sales pace. Under 3 favors sellers; over 6 favors buyers.',
  },
  median_dom: {
    key: 'median_dom',
    label: 'Median days on market',
    short: 'Days on market',
    format: 'days',
    changeKind: 'diff',
    goodDirection: 'neutral',
    definition: 'Median days from listing to pending sale (Redfin). YoY is a difference in days.',
  },
  avg_sale_to_list: {
    key: 'avg_sale_to_list',
    label: 'Sale-to-list ratio',
    short: 'Sale-to-list',
    format: 'percent',
    changeKind: 'pp',
    goodDirection: 'neutral',
    definition: 'Average sale price divided by final list price. YoY is a change in percentage points.',
  },
  sold_above_list: {
    key: 'sold_above_list',
    label: 'Sold above list',
    short: 'Above list',
    format: 'percent',
    changeKind: 'pp',
    goodDirection: 'neutral',
    definition: 'Share of homes that sold above their list price.',
  },
  price_drops: {
    key: 'price_drops',
    label: 'Listings with price drops',
    short: '% price drops',
    format: 'percent',
    changeKind: 'pp',
    goodDirection: 'neutral',
    definition: 'Share of active listings with a price cut during the month.',
  },
  off_market_in_two_weeks: {
    key: 'off_market_in_two_weeks',
    label: 'Off market in 2 weeks',
    short: 'Off in 2 wks',
    format: 'percent',
    changeKind: 'pp',
    goodDirection: 'neutral',
    definition: 'Share of homes that went under contract within two weeks of listing.',
  },
  zhvi: {
    key: 'zhvi',
    label: 'Zillow Home Value Index',
    short: 'Zillow value',
    format: 'currency',
    changeKind: 'ratio',
    goodDirection: 'neutral',
    definition: 'Typical home value for mid-tier homes; smoothed and seasonally adjusted (Zillow).',
  },
  zori: {
    key: 'zori',
    label: 'Zillow Observed Rent Index',
    short: 'Zillow rent',
    format: 'currency',
    changeKind: 'ratio',
    goodDirection: 'neutral',
    definition: 'Typical observed market rent (Zillow).',
  },
  permits_total: {
    key: 'permits_total',
    label: 'Building permits (units)',
    short: 'Permits',
    format: 'count',
    changeKind: 'ratio',
    goodDirection: 'neutral',
    definition: 'Housing units authorized by building permits (Census BPS). YoY uses rolling 12-month sums.',
  },
  permits_1unit: {
    key: 'permits_1unit',
    label: 'Single-family permits',
    short: '1-unit permits',
    format: 'count',
    changeKind: 'ratio',
    goodDirection: 'neutral',
    definition: 'Single-family units authorized (Census BPS).',
  },
  permits_5plus: {
    key: 'permits_5plus',
    label: '5+ unit permits',
    short: '5+ permits',
    format: 'count',
    changeKind: 'ratio',
    goodDirection: 'neutral',
    definition: 'Units in buildings with 5+ units authorized; the multifamily pipeline.',
  },
};

/** The v1 metric toggle order (SPEC_WEBSITE §7.2); unknown registry entries append after. */
export const TOGGLE_ORDER = [
  'median_sale_price',
  'inventory',
  'median_dom',
  'price_drops',
  'avg_sale_to_list',
  'months_of_supply',
  'homes_sold',
  'new_listings',
  'zhvi',
  'zori',
  'permits_total',
];

export interface ResolvedMetric extends MetricDef {
  note?: string | null;
  source?: string;
}

/** Merge the agent's registry over site fallbacks; agent values win. */
export function resolveRegistry(registry: MetricRegistryEntry[]): ResolvedMetric[] {
  const out = registry.map((r) => {
    const fb = METRICS[r.key];
    return {
      key: r.key,
      label: r.label,
      short: fb?.short ?? r.label,
      format: r.format,
      changeKind: r.change_kind,
      goodDirection: r.good_direction ?? fb?.goodDirection ?? 'neutral',
      definition: fb?.definition ?? r.note ?? r.label,
      note: r.note,
      source: r.source,
    } satisfies ResolvedMetric;
  });
  const rank = (k: string) => {
    const i = TOGGLE_ORDER.indexOf(k);
    return i === -1 ? 100 : i;
  };
  return out.sort((a, b) => rank(a.key) - rank(b.key));
}

/** Toggle metrics: the registry minus sub-series that the v1 toggle folds away. */
export function toggleMetrics(resolved: ResolvedMetric[]): ResolvedMetric[] {
  const hidden = new Set(['sold_above_list', 'off_market_in_two_weeks', 'permits_1unit', 'permits_5plus']);
  return resolved.filter((m) => !hidden.has(m.key));
}

export const isRatioMetric = (m: Pick<MetricDef, 'changeKind'> | undefined) => m?.changeKind === 'pp';

/** YoY for a metric value: `yoy`, or `yoy_12m` for permits. */
export function yoyOf(v: MetricValue | undefined): number | null {
  if (!v) return null;
  return v.yoy ?? v.yoy_12m ?? null;
}

/** Delta format for a metric's change. */
export function changeFormat(m: Pick<MetricDef, 'changeKind' | 'format'>): StatFormat {
  if (m.changeKind === 'ratio') return 'percent_signed';
  if (m.changeKind === 'pp') return 'pp_signed';
  return m.format === 'days' ? 'days' : 'decimal1';
}
