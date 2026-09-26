import { describe, expect, it } from 'vitest';
import {
  count,
  countSigned,
  countSignedThousands,
  currency,
  currencyCompact,
  days,
  decimal1,
  DASH,
  formatDate,
  formatDelta,
  formatMonth,
  formatValue,
  percent,
  percentSigned,
  ppSigned,
  ratio,
  relativeTime,
  daysUntil,
} from '@/lib/format';

describe('formatters', () => {
  it('currency_compact', () => {
    expect(currencyCompact(412000)).toBe('$412K');
    expect(currencyCompact(1_200_000)).toBe('$1.2M');
    expect(currencyCompact(4_200_000)).toBe('$4.2M');
    expect(currencyCompact(15_000_000)).toBe('$15M');
    expect(currencyCompact(950)).toBe('$950');
    expect(currencyCompact(-2500)).toBe('−$2.5K');
  });
  it('currency', () => {
    expect(currency(412500)).toBe('$412,500');
    expect(currency(2528.27, true)).toBe('$2,528.27');
  });
  it('percent (level)', () => {
    expect(percent(6.84)).toBe('6.84%');
    expect(percent(2.9)).toBe('2.9%');
    expect(percent(4.4, 1)).toBe('4.4%');
  });
  it('percent_signed (a change, given as ratio)', () => {
    expect(percentSigned(0.042)).toBe('+4.2%');
    expect(percentSigned(-0.031)).toBe('−3.1%');
    expect(percentSigned(0)).toBe('0.0%');
  });
  it('pp_signed never renders %', () => {
    expect(ppSigned(0.25)).toBe('+0.25 pp');
    expect(ppSigned(-0.07)).toBe('−0.07 pp');
    expect(ppSigned(0.25)).not.toContain('%');
  });
  it('counts', () => {
    expect(count(12431)).toBe('12,431');
    expect(countSigned(1420)).toBe('+1,420');
    expect(countSigned(-5)).toBe('−5');
    expect(countSignedThousands(142)).toBe('+142K');
    expect(countSignedThousands(-19)).toBe('−19K');
    expect(countSignedThousands(1420)).toBe('+1.4M');
  });
  it('decimal1, days, ratio', () => {
    expect(decimal1(5.8)).toBe('5.8');
    expect(days(34)).toBe('34 days');
    expect(days(1)).toBe('1 day');
    expect(ratio(0.987)).toBe('98.7%');
  });
  it('null/undefined/NaN render —', () => {
    for (const f of [
      currencyCompact,
      currency,
      percent,
      percentSigned,
      ppSigned,
      count,
      countSigned,
      countSignedThousands,
      decimal1,
      days,
      ratio,
    ]) {
      expect(f(null)).toBe(DASH);
      expect(f(undefined)).toBe(DASH);
      expect(f(NaN)).toBe(DASH);
    }
    expect(formatValue(null, 'currency')).toBe(DASH);
    expect(formatDelta(undefined, 'pp_signed')).toBe(DASH);
    expect(formatDate(null)).toBe(DASH);
  });
  it('formatValue dispatches by format, with ratio shares', () => {
    expect(formatValue(431200, 'currency_compact')).toBe('$431K');
    expect(formatValue(0.112, 'percent', { isRatio: true })).toBe('11.2%');
    expect(formatValue(6.18, 'percent')).toBe('6.18%');
    expect(formatValue(0.968, 'ratio')).toBe('96.8%');
  });
  it('formatDelta always carries a sign', () => {
    expect(formatDelta(0.021, 'percent_signed')).toBe('+2.1%');
    expect(formatDelta(0.018, 'pp_signed', { isRatio: true })).toBe('+1.8 pp');
    expect(formatDelta(9, 'days')).toBe('+9 days');
    expect(formatDelta(0.7, 'decimal1')).toBe('+0.7');
    expect(formatDelta(-19, 'count_signed_thousands')).toBe('−19K');
  });
  it('dates', () => {
    expect(formatDate('2026-09-19')).toBe('Sep 19, 2026');
    expect(formatMonth('2026-08-31')).toBe('Aug 2026');
    const now = new Date('2026-09-26T12:00:00Z');
    expect(relativeTime('2026-09-26T09:00:00Z', now)).toBe('3 hours ago');
    expect(relativeTime('2026-09-25T12:00:00Z', now)).toBe('yesterday');
    expect(relativeTime('2026-09-26T11:59:50Z', now)).toBe('just now');
    expect(daysUntil('2026-10-02T12:00:00Z', now)).toBe(6);
  });
});
