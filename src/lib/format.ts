import type { StatFormat } from './schemas/common';

/** Number & date formatting (SPEC_WEBSITE §6). Every function renders null/undefined/NaN as "—". */

export const DASH = '—';
const MINUS = '−'; // U+2212, typographic minus

type Num = number | null | undefined;
const isNum = (x: Num): x is number => typeof x === 'number' && Number.isFinite(x);

function signed(x: number, body: string): string {
  if (x > 0) return `+${body}`;
  if (x < 0) return `${MINUS}${body}`;
  return body;
}

const nf = (min: number, max: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });

/** $412K, $1.2M, $950 */
export function currencyCompact(x: Num): string {
  if (!isNum(x)) return DASH;
  const a = Math.abs(x);
  let body: string;
  if (a >= 1e9) body = `$${trim(a / 1e9, a >= 1e10 ? 0 : 1)}B`;
  else if (a >= 1e6) body = `$${trim(a / 1e6, a >= 1e7 ? 0 : 1)}M`;
  else if (a >= 1e3) body = `$${trim(a / 1e3, a >= 1e4 ? 0 : 1)}K`;
  else body = `$${Math.round(a)}`;
  return x < 0 ? `${MINUS}${body}` : body;
}

function trim(x: number, digits: number): string {
  const s = x.toFixed(digits);
  return digits > 0 ? s.replace(/\.0+$/, '') : s;
}

/** $412,500 (cents only when asked) */
export function currency(x: Num, cents = false): string {
  if (!isNum(x)) return DASH;
  const body = `$${nf(cents ? 2 : 0, cents ? 2 : 0).format(Math.abs(x))}`;
  return x < 0 ? `${MINUS}${body}` : body;
}

/** A level that is already in percent units: 6.84 → "6.84%". */
export function percent(x: Num, digits?: number): string {
  if (!isNum(x)) return DASH;
  const d = digits ?? (Math.abs(x) < 10 && !Number.isInteger(x * 10) ? 2 : 1);
  const body = `${nf(d, d).format(Math.abs(x))}%`;
  return x < 0 ? `${MINUS}${body}` : body;
}

/** A ratio shown as a percent: 0.987 → "98.7%". */
export function ratioPercent(x: Num, digits = 1): string {
  return isNum(x) ? percent(x * 100, digits) : DASH;
}

/** A change expressed as a ratio: 0.042 → "+4.2%". */
export function percentSigned(x: Num, digits = 1): string {
  if (!isNum(x)) return DASH;
  const v = x * 100;
  const rounded = Number(v.toFixed(digits));
  return signed(rounded, `${nf(digits, digits).format(Math.abs(rounded))}%`);
}

/** A change in a rate, in percentage points. `x` is in pp already (0.25 → "+0.25 pp"). */
export function ppSigned(x: Num, digits = 2): string {
  if (!isNum(x)) return DASH;
  const rounded = Number(x.toFixed(digits));
  return signed(rounded, `${nf(digits, digits).format(Math.abs(rounded))} pp`);
}

export function count(x: Num): string {
  return isNum(x) ? (x < 0 ? MINUS : '') + nf(0, 0).format(Math.abs(Math.round(x))) : DASH;
}

export function countSigned(x: Num): string {
  if (!isNum(x)) return DASH;
  const r = Math.round(x);
  return signed(r, nf(0, 0).format(Math.abs(r)));
}

/** Value already in thousands (payrolls): 142 → "+142K", 1420 → "+1.4M". */
export function countSignedThousands(x: Num): string {
  if (!isNum(x)) return DASH;
  const a = Math.abs(x);
  const body = a >= 1000 ? `${trim(a / 1000, 1)}M` : `${Math.round(a)}K`;
  return signed(Math.round(x) === 0 ? 0 : x, body);
}

export function decimal1(x: Num): string {
  return isNum(x) ? (x < 0 ? MINUS : '') + nf(1, 1).format(Math.abs(x)) : DASH;
}

export function days(x: Num): string {
  if (!isNum(x)) return DASH;
  const r = Math.round(x);
  return `${count(r)} ${Math.abs(r) === 1 ? 'day' : 'days'}`;
}

export function daysSigned(x: Num): string {
  if (!isNum(x)) return DASH;
  const r = Math.round(x);
  return `${countSigned(r)} ${Math.abs(r) === 1 ? 'day' : 'days'}`;
}

/** Sale-to-list and other ratios show as a percent. */
export function ratio(x: Num): string {
  return ratioPercent(x, 1);
}

export interface FormatOptions {
  /** The value is a 0–1 share (real-estate `change_kind: pp` metrics) rather than percent units. */
  isRatio?: boolean;
}

/** Format a level by its declared `format`. */
export function formatValue(x: Num, format: StatFormat | null | undefined, opts: FormatOptions = {}): string {
  switch (format) {
    case 'currency_compact':
      return currencyCompact(x);
    case 'currency':
      return currency(x);
    case 'percent':
      return opts.isRatio ? ratioPercent(x) : percent(x);
    case 'percent_signed':
      return percentSigned(x);
    case 'pp_signed':
      return opts.isRatio ? ppSigned(isNum(x) ? x * 100 : x, 1) : ppSigned(x);
    case 'count':
      return count(x);
    case 'count_signed':
      return countSigned(x);
    case 'count_signed_thousands':
      return countSignedThousands(x);
    case 'decimal1':
      return decimal1(x);
    case 'days':
      return days(x);
    case 'ratio':
      return ratio(x);
    default:
      return isNum(x) ? nf(0, 2).format(x) : DASH;
  }
}

/** Format a change. Changes always carry a sign, whatever the declared format. */
export function formatDelta(x: Num, format: StatFormat | null | undefined, opts: FormatOptions = {}): string {
  if (!isNum(x)) return DASH;
  switch (format) {
    case 'percent_signed':
    case 'percent':
      return format === 'percent' && !opts.isRatio ? ppSigned(x) : percentSigned(x);
    case 'pp_signed':
      return opts.isRatio ? ppSigned(x * 100, 1) : ppSigned(x);
    case 'count':
    case 'count_signed':
      return countSigned(x);
    case 'count_signed_thousands':
      return countSignedThousands(x);
    case 'days':
      return daysSigned(x);
    case 'decimal1': {
      const r = Number(x.toFixed(1));
      return signed(r, nf(1, 1).format(Math.abs(r)));
    }
    case 'currency':
    case 'currency_compact':
      return signed(x, (format === 'currency' ? currency : currencyCompact)(Math.abs(x)));
    case 'ratio':
      return ppSigned(x * 100, 1);
    default:
      return signed(x, nf(0, 2).format(Math.abs(x)));
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse "YYYY-MM-DD" as a calendar date (no timezone shift) or a full ISO timestamp. */
export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Sep 19, 2026" */
export function formatDate(s: string | Date | null | undefined): string {
  const d = s instanceof Date ? s : parseDate(s);
  if (!d) return DASH;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Sep 19" */
export function formatShortDate(s: string | Date | null | undefined): string {
  const d = s instanceof Date ? s : parseDate(s);
  if (!d) return DASH;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Aug 2026" */
export function formatMonth(s: string | null | undefined): string {
  const d = parseDate(s);
  if (!d) return DASH;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Sep 19, 2026, 3:02 PM UTC" */
export function formatDateTime(s: string | null | undefined): string {
  const d = parseDate(s);
  if (!d) return DASH;
  const h = d.getUTCHours();
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${formatDate(d)}, ${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'AM' : 'PM'} UTC`;
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "3 hours ago", "in 2 days", "yesterday" */
export function relativeTime(s: string | Date | null | undefined, now: Date = new Date()): string {
  const d = s instanceof Date ? s : parseDate(s ?? null);
  if (!d) return DASH;
  const sec = (d.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(sec);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(sec / (86400 * 30.44)), 'month');
  return rtf.format(Math.round(sec / (86400 * 365.25)), 'year');
}

/** Whole days from `now` until `s` (negative when past). */
export function daysUntil(s: string | null | undefined, now: Date = new Date()): number | null {
  const d = parseDate(s);
  if (!d) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

export function usd(x: Num): string {
  return isNum(x) ? `$${x.toFixed(2)}` : DASH;
}

/** Small LLM costs: "$0.0071", "$0.09", "$1.24". */
export function usdPrecise(x: Num): string {
  if (!isNum(x)) return DASH;
  if (x === 0) return '$0';
  if (Math.abs(x) < 0.01) return `$${x.toFixed(4)}`;
  if (Math.abs(x) < 1) return `$${x.toFixed(3)}`;
  return `$${x.toFixed(2)}`;
}

/** Latency: "340 ms", "1.2 s", "4 min 12 s". */
export function duration(ms: Num): string {
  if (!isNum(ms)) return DASH;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s - m * 60);
  return rest ? `${m} min ${rest} s` : `${m} min`;
}

/** Eval score 0–1 → "86%" (one decimal under 10 points of a bound is not needed; whole points). */
export function score(x: Num): string {
  return isNum(x) ? `${Math.round(x * 100)}%` : DASH;
}

/** Score change in percentage points, signed: "+4 pts". */
export function scoreDelta(x: Num): string {
  if (!isNum(x)) return DASH;
  const pts = Math.round(x * 100);
  return pts === 0 ? '±0 pts' : `${pts > 0 ? '+' : MINUS}${Math.abs(pts)} pts`;
}
