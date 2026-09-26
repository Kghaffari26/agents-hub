import type { GrantsRow, Recommendation } from '@/lib/schemas/grants';
import { toCsv } from '@/lib/csv';
import { daysUntil, parseDate } from '@/lib/format';

/** Pure filter / sort / CSV logic for the grants table (SPEC_WEBSITE §7.4). No React here. */

export type SourceKey = GrantsRow['source'];

export interface GrantsFilters {
  /** Case-insensitive substring match on title or agency. */
  q: string;
  source: SourceKey | '';
  type: string;
  /** Raw agency strings; empty = any. */
  agencies: string[];
  setAside: string;
  naics: string;
  /** Deadline within N days from now (inclusive); null = any. */
  closingWithin: number | null;
  /** Minimum fit score; 0 = no minimum. Rows with no fit are excluded when > 0. */
  minFit: number;
  newOnly: boolean;
}

export const DEFAULT_FILTERS: GrantsFilters = {
  q: '',
  source: '',
  type: '',
  agencies: [],
  setAside: '',
  naics: '',
  closingWithin: null,
  minFit: 0,
  newOnly: false,
};

/** Sentinel for the "no set-aside" option in the set-aside filter. */
export const NO_SET_ASIDE = '__none__';

export const SOURCE_LABEL: Record<SourceKey, string> = { sam: 'SAM.gov', grants_gov: 'Grants.gov' };

export function sourceLabel(s: SourceKey): string {
  return SOURCE_LABEL[s] ?? s;
}

const SMALL = new Set(['of', 'the', 'and', 'for', 'on', 'in', 'to', 'a', 'an', 'at', 'by']);
const ACRONYMS = new Set([
  'US',
  'U.S.',
  'NASA',
  'USDA',
  'DOD',
  'DHS',
  'VA',
  'GSA',
  'SBA',
  'NIH',
  'NSF',
  'NOAA',
  'IT',
  'AI',
]);

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w, i) => {
      if (/^\s+$|^-$/.test(w) || !w) return w;
      if (ACRONYMS.has(w.toUpperCase())) return w.toUpperCase();
      if (i > 0 && SMALL.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join('');
}

/**
 * SAM.gov agencies come as "VETERANS AFFAIRS, DEPARTMENT OF" / "INTERIOR, DEPARTMENT OF THE".
 * Render them as "Department of Veterans Affairs" / "Department of the Interior".
 */
export function formatAgency(raw: string | null | undefined): string {
  if (!raw) return '—';
  const m = /^(.+?),\s*(DEPARTMENT OF(?: THE)?)$/i.exec(raw.trim());
  const s = m ? `${m[2]} ${m[1]}` : raw.trim();
  return s === s.toUpperCase() ? titleCase(s) : s;
}

/** Whole days until the deadline (ceil), or null when there is no deadline. */
export function daysLeft(deadline: string | null | undefined, now: Date): number | null {
  return daysUntil(deadline ?? null, now);
}

export function filterRows(rows: readonly GrantsRow[], f: GrantsFilters, now: Date): GrantsRow[] {
  const q = f.q.trim().toLowerCase();
  const agencies = f.agencies.length ? new Set(f.agencies) : null;
  return rows.filter((r) => {
    if (
      q &&
      !r.title.toLowerCase().includes(q) &&
      !r.agency.toLowerCase().includes(q) &&
      !formatAgency(r.agency).toLowerCase().includes(q)
    )
      return false;
    if (f.source && r.source !== f.source) return false;
    if (f.type && r.type !== f.type) return false;
    if (agencies && !agencies.has(r.agency)) return false;
    if (f.setAside) {
      if (f.setAside === NO_SET_ASIDE ? r.set_aside != null : r.set_aside !== f.setAside) return false;
    }
    if (f.naics && !r.naics.includes(f.naics)) return false;
    if (f.closingWithin != null) {
      const d = daysLeft(r.deadline, now);
      if (d == null || d < 0 || d > f.closingWithin) return false;
    }
    if (f.minFit > 0 && (r.fit == null || r.fit < f.minFit)) return false;
    if (f.newOnly && !r.is_new) return false;
    return true;
  });
}

export type SortKey =
  'fit' | 'title' | 'agency' | 'source' | 'type' | 'naics' | 'set_aside' | 'posted' | 'deadline' | 'value';

export interface SortState {
  key: SortKey;
  desc: boolean;
}

export const DEFAULT_SORT: SortState = { key: 'fit', desc: true };

/** The direction a column sorts in when first clicked. */
export const FIRST_SORT_DESC: Record<SortKey, boolean> = {
  fit: true,
  value: true,
  posted: true,
  deadline: false,
  title: false,
  agency: false,
  source: false,
  type: false,
  naics: false,
  set_aside: false,
};

function sortValue(r: GrantsRow, key: SortKey): string | number | null {
  switch (key) {
    case 'fit':
      return r.fit;
    case 'value':
      return r.value;
    case 'deadline':
      return r.deadline ? (parseDate(r.deadline)?.getTime() ?? null) : null;
    case 'posted':
      return r.posted;
    case 'title':
      return r.title.toLowerCase();
    case 'agency':
      return formatAgency(r.agency).toLowerCase();
    case 'source':
      return sourceLabel(r.source);
    case 'type':
      return r.type;
    case 'naics':
      return r.naics[0] ?? null;
    case 'set_aside':
      return r.set_aside;
  }
}

/**
 * Stable sort; null/missing values always sort last whatever the direction.
 * Ties fall back to fit (desc) then title so the order is deterministic.
 */
export function sortRows(rows: readonly GrantsRow[], sort: SortState = DEFAULT_SORT): GrantsRow[] {
  const dir = sort.desc ? -1 : 1;
  const cmp = (a: string | number, b: string | number) =>
    typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
  return rows
    .map((r, i) => ({ r, i, v: sortValue(r, sort.key) }))
    .sort((a, b) => {
      if (a.v == null && b.v != null) return 1;
      if (b.v == null && a.v != null) return -1;
      if (a.v != null && b.v != null) {
        const c = cmp(a.v, b.v);
        if (c !== 0) return c * dir;
      }
      return a.i - b.i;
    })
    .map((x) => x.r);
}

export const CSV_HEADERS = [
  'Fit',
  'Title',
  'Agency',
  'Source',
  'Type',
  'NAICS',
  'Set-aside',
  'Posted',
  'Deadline',
  'Value',
  'URL',
] as const;

/** RFC 4180 CSV of the given rows (the visible columns plus URL), in the given order. */
export function rowsToCsv(rows: readonly GrantsRow[]): string {
  return toCsv(
    [...CSV_HEADERS],
    rows.map((r) => [
      r.fit,
      r.title,
      formatAgency(r.agency),
      sourceLabel(r.source),
      r.type,
      r.naics.join(' '),
      r.set_aside,
      r.posted,
      r.deadline,
      r.value,
      r.url,
    ]),
  );
}

export function csvFilename(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `grants-matches-${y}-${m}-${d}.csv`;
}

/** Distinct option values for the facet filters. */
export function facetOptions(rows: readonly GrantsRow[]) {
  const uniq = (xs: (string | null | undefined)[]) =>
    [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
  return {
    sources: uniq(rows.map((r) => r.source)) as SourceKey[],
    types: uniq(rows.map((r) => r.type)),
    agencies: uniq(rows.map((r) => r.agency)).sort((a, b) => formatAgency(a).localeCompare(formatAgency(b))),
    setAsides: uniq(rows.map((r) => r.set_aside)),
    hasNoSetAside: rows.some((r) => r.set_aside == null),
    naics: uniq(rows.flatMap((r) => r.naics)),
  };
}

export function isFiltered(f: GrantsFilters): boolean {
  return (
    f.q.trim() !== '' ||
    f.source !== '' ||
    f.type !== '' ||
    f.agencies.length > 0 ||
    f.setAside !== '' ||
    f.naics !== '' ||
    f.closingWithin != null ||
    f.minFit > 0 ||
    f.newOnly
  );
}

export const RECOMMENDATION_ORDER: Recommendation[] = ['Pursue', 'Consider', 'Pass'];
