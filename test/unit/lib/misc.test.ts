import { describe, expect, it } from 'vitest';
import { arrow, deltaTone, divergingColor, percentileBounds } from '@/lib/colors';
import { effectiveStatus, isStale } from '@/lib/stale';
import { csvField, toCsv } from '@/lib/csv';
import {
  addMetro,
  parseExplorerState,
  removeMetro,
  serializeExplorerState,
  type ParseContext,
} from '@/lib/urlState';
import { changeFormat, METRICS, resolveRegistry, toggleMetrics, yoyOf } from '@/lib/metrics';
import { dataUrl } from '@/lib/data/url';

describe('semantic delta coloring', () => {
  it('uses good direction, not sign', () => {
    expect(deltaTone(0.2, 'down')).toBe('bad'); // rising unemployment
    expect(deltaTone(-0.1, 'down')).toBe('good');
    expect(deltaTone(5, 'up')).toBe('good');
    expect(deltaTone(0.14, 'neutral')).toBe('neutral'); // rising inventory
    expect(deltaTone(0, 'up')).toBe('flat');
    expect(deltaTone(null, 'up')).toBe('flat');
  });
  it('arrows', () => {
    expect(arrow(1)).toBe('▲');
    expect(arrow(-1)).toBe('▼');
    expect(arrow(0)).toBe('');
  });
  it('diverging scale clamps', () => {
    const p = { neg: '#ff0000', mid: '#ffffff', pos: '#00ff00' };
    expect(divergingColor(10, -1, 1, p)).toBe('rgb(0, 255, 0)');
    expect(divergingColor(-10, -1, 1, p)).toBe('rgb(255, 0, 0)');
    expect(divergingColor(0, -1, 1, p)).toBe('rgb(255, 255, 255)');
    expect(divergingColor(null, -1, 1, p)).toBe('#ffffff');
  });
  it('percentile bounds ignore nulls', () => {
    const v = Array.from({ length: 101 }, (_, i) => i);
    expect(percentileBounds([...v, null], 0.05)).toEqual([5, 95]);
  });
});

describe('stale detection', () => {
  const now = new Date('2026-09-26T12:00:00Z');
  it('stale after 2× the expected interval', () => {
    expect(isStale('2026-09-25T12:00:00Z', 24, now)).toBe(false);
    expect(isStale('2026-09-24T11:00:00Z', 24, now)).toBe(true);
    expect(isStale('2026-09-19T15:00:00Z', 168, now)).toBe(false);
    expect(isStale('2026-09-10T15:00:00Z', 168, now)).toBe(true);
    expect(isStale(null, 24, now)).toBe(true);
  });
  it('a manually aged timestamp flips ok → stale; failed always wins', () => {
    expect(effectiveStatus('ok', '2026-09-26T06:00:00Z', 24, now)).toBe('ok');
    expect(effectiveStatus('ok', '2026-08-01T06:00:00Z', 24, now)).toBe('stale');
    expect(effectiveStatus('failed', '2026-09-26T06:00:00Z', 24, now)).toBe('failed');
  });
});

describe('CSV (RFC 4180)', () => {
  it('quotes fields with commas, quotes and newlines', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField(null)).toBe('');
    expect(csvField(['x', 'y'])).toBe('x; y');
  });
  it('uses CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

describe('URL state', () => {
  const ctx: ParseContext = {
    knownSlugs: new Set(['austin-tx', 'denver-co', 'tampa-fl', 'miami-fl']),
    metricKeys: ['median_sale_price', 'inventory'],
    defaults: { metros: ['austin-tx'], metric: 'median_sale_price', range: '3y', rate: false },
  };
  const p = (s: string) => new URLSearchParams(s);
  it('round-trips', () => {
    const s = { metros: ['austin-tx', 'denver-co'], metric: 'inventory', range: '2y' as const, rate: true };
    expect(serializeExplorerState(s)).toBe('m=austin-tx,denver-co&metric=inventory&range=2y&rate=1');
    expect(parseExplorerState(p(serializeExplorerState(s)), ctx)).toEqual(s);
  });
  it('is defensive: unknown slugs dropped, max 3, bad values → defaults', () => {
    const s = parseExplorerState(
      p('m=nowhere,austin-tx,austin-tx,denver-co,tampa-fl,miami-fl&metric=bogus&range=9y&rate=0'),
      ctx,
    );
    expect(s.metros).toEqual(['austin-tx', 'denver-co', 'tampa-fl']);
    expect(s.metric).toBe('median_sale_price');
    expect(s.range).toBe('3y');
    expect(s.rate).toBe(false);
    expect(parseExplorerState(p('m=nope'), ctx).metros).toEqual(['austin-tx']);
    expect(parseExplorerState(p(''), ctx)).toEqual(ctx.defaults);
    expect(parseExplorerState(p('m='), ctx).metros).toEqual([]); // cleared, not defaults
    expect(parseExplorerState(p('m=us,austin-tx'), ctx).metros).toEqual(['us', 'austin-tx']);
  });
  it('add replaces the oldest when full; remove', () => {
    expect(addMetro(['a', 'b', 'c'], 'd')).toEqual(['b', 'c', 'd']);
    expect(addMetro(['a', 'b'], 'a')).toEqual(['a', 'b']);
    expect(removeMetro(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('metrics registry', () => {
  it('agent registry wins; order follows the v1 toggle', () => {
    const r = resolveRegistry([
      {
        key: 'zori',
        label: 'Rent',
        format: 'currency',
        change_kind: 'ratio',
        good_direction: 'neutral',
        source: 'zillow',
      },
      {
        key: 'homes_sold',
        label: 'Sold!',
        format: 'count',
        change_kind: 'ratio',
        good_direction: 'up',
        source: 'redfin',
      },
      {
        key: 'new_metric',
        label: 'New',
        format: 'count',
        change_kind: 'ratio',
        good_direction: 'down',
        source: 'x',
      },
    ]);
    expect(r.map((m) => m.key)).toEqual(['homes_sold', 'zori', 'new_metric']);
    expect(r[0].label).toBe('Sold!');
    expect(toggleMetrics(r).map((m) => m.key)).toContain('new_metric');
  });
  it('change formats never percent-of-percent', () => {
    expect(changeFormat(METRICS.price_drops)).toBe('pp_signed');
    expect(changeFormat(METRICS.median_sale_price)).toBe('percent_signed');
    expect(changeFormat(METRICS.median_dom)).toBe('days');
    expect(yoyOf({ value: 1, yoy_12m: 0.2 })).toBe(0.2);
  });
});

describe('dataUrl', () => {
  it('prefixes /data and strips leading slashes', () => {
    expect(dataUrl('/real_estate/latest.json')).toBe('/data/real_estate/latest.json');
    expect(dataUrl('data/macro/latest.json')).toBe('/data/macro/latest.json');
  });
});
