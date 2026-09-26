'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type { MetroSummary } from '@/lib/schemas/realEstate';
import { changeFormat, type ResolvedMetric } from '@/lib/metrics';
import { formatDelta, formatValue } from '@/lib/format';
import { useThemeColors } from '@/lib/hooks';
import { buildMapData, type MapPoint } from './mapScale';
import { Skeleton } from '../common/States';
import { WhenVisible } from '../common/WhenVisible';

// Leaflet touches `window`: client-only, split into its own chunk (SPEC_WEBSITE §2, §7.2).
const MetroMap = dynamic(() => import('./MetroMap'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" label="Loading map" />,
});

type SortKey = 'name' | 'value' | 'size';

export function MapSection({
  metros,
  metric,
  selected,
  onSelect,
}: {
  metros: MetroSummary[];
  metric: ResolvedMetric;
  selected: string[];
  onSelect: (slug: string) => void;
}) {
  const c = useThemeColors();
  const [asTable, setAsTable] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'value', dir: -1 });
  const { points, scale } = useMemo(
    () =>
      buildMapData(metros, metric, {
        neg: c['diverge-neg'],
        mid: c['diverge-mid'],
        pos: c['diverge-pos'],
        seqFrom: c['diverge-mid'],
        seqTo: c['chart-1'],
      }),
    [metros, metric, c],
  );
  const opts = { isRatio: metric.changeKind === 'pp' };
  const fmt = (p: MapPoint) =>
    scale.mode === 'yoy'
      ? `${formatDelta(p.value, changeFormat(metric), opts)} YoY · ${formatValue(p.level, metric.format, opts)}`
      : formatValue(p.level, metric.format, opts);
  const legendLo =
    scale.mode === 'yoy'
      ? formatDelta(scale.lo, changeFormat(metric), opts)
      : formatValue(scale.lo, metric.format, opts);
  const legendHi =
    scale.mode === 'yoy'
      ? formatDelta(scale.hi, changeFormat(metric), opts)
      : formatValue(scale.hi, metric.format, opts);
  const rows = [...points].sort((a, b) => {
    const k = sort.key;
    if (k === 'name') return a.name.localeCompare(b.name) * sort.dir;
    const av = k === 'value' ? a.value : a.size;
    const bv = k === 'value' ? b.value : b.size;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * sort.dir;
  });
  const th = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="inline-flex items-center gap-1 uppercase"
        onClick={() =>
          setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'name' ? 1 : -1 }))
        }
      >
        {label}
        <span aria-hidden>{sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
  const gradient =
    scale.mode === 'yoy'
      ? metric.goodDirection === 'down'
        ? `linear-gradient(to right, ${c['diverge-pos']}, ${c['diverge-mid']}, ${c['diverge-neg']})`
        : `linear-gradient(to right, ${c['diverge-neg']}, ${c['diverge-mid']}, ${c['diverge-pos']})`
      : `linear-gradient(to right, ${c['diverge-mid']}, ${c['chart-1']})`;

  return (
    <section aria-labelledby="map-title" className="space-y-3" data-testid="map-section">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="map-title" className="section-title">
            Map: {metric.label} {scale.mode === 'yoy' ? 'YoY' : ''}
          </h2>
          <p className="text-sm text-muted">
            Circle size = market size (homes sold, 12 mo). Click a metro to add it to the comparison.
          </p>
        </div>
        <button type="button" className="btn" aria-pressed={asTable} onClick={() => setAsTable((t) => !t)}>
          {asTable ? 'View as map' : 'View as table'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted" aria-label="Map legend">
        <span className="num">{legendLo}</span>
        <span className="h-2.5 w-40 rounded-full" style={{ background: gradient }} aria-hidden />
        <span className="num">{legendHi}</span>
        <span>
          ({scale.mode === 'yoy' ? 'YoY change, clamped to the 5th–95th percentile' : 'latest level'})
        </span>
      </div>
      {asTable ? (
        <div className="table-wrap max-h-[440px] overflow-y-auto rounded-card border border-border">
          <table className="data-table num" data-testid="map-table">
            <caption className="sr-only">{metric.label} by metro</caption>
            <thead className="sticky top-0 bg-surface">
              <tr>
                {th('name', 'Metro')}
                {th('value', scale.mode === 'yoy' ? 'YoY' : 'Level')}
                <th scope="col">Latest</th>
                {th('size', 'Homes sold (12 mo)')}
                <th scope="col">
                  <span className="sr-only">Compare</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.slug}>
                  <th scope="row" className="font-medium">
                    {p.name}
                  </th>
                  <td>
                    <span
                      className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                      style={{ background: scale.color(p.value) }}
                      aria-hidden
                    />
                    {scale.mode === 'yoy'
                      ? formatDelta(p.value, changeFormat(metric), opts)
                      : formatValue(p.value, metric.format, opts)}
                  </td>
                  <td>{formatValue(p.level, metric.format, opts)}</td>
                  <td>{formatValue(p.size, 'count')}</td>
                  <td>
                    <button
                      type="button"
                      className="btn py-0.5 text-xs"
                      disabled={selected.includes(p.slug)}
                      onClick={() => onSelect(p.slug)}
                      aria-label={`Compare ${p.name}`}
                    >
                      {selected.includes(p.slug) ? 'Selected' : 'Compare'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="h-[420px] overflow-hidden rounded-card border border-border md:h-[480px]"
          data-testid="metro-map"
        >
          {/* Leaflet (and its tiles) load only when the map nears the viewport. */}
          <WhenVisible placeholder={<Skeleton className="h-full w-full" label="Loading map" />}>
            <div className="h-[420px] md:h-[480px]">
              <MetroMap
                points={points}
                scale={scale}
                selected={selected}
                onSelect={onSelect}
                formatValue={fmt}
              />
            </div>
          </WhenVisible>
        </div>
      )}
    </section>
  );
}
