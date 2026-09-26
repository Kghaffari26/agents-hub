'use client';

import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useThemeColors, usePrefersReducedMotion } from '@/lib/hooks';
import { formatMonth, formatValue, percent } from '@/lib/format';
import type { ResolvedMetric } from '@/lib/metrics';
import { LINE_COLORS, shortName, type ChartRow } from './helpers';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const tickMonth = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ’${d.slice(2, 4)}`;

function compactTick(v: number, metric: ResolvedMetric) {
  const isRatio = metric.changeKind === 'pp';
  if (metric.format === 'currency') {
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `$${Math.round(v / 1e3)}K`;
    return `$${Math.round(v)}`;
  }
  if (metric.format === 'count' && Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (metric.format === 'count' && Math.abs(v) >= 1e3)
    return `${(v / 1e3).toFixed(Math.abs(v) >= 1e4 ? 0 : 1)}K`;
  if (isRatio) return `${(v * 100).toFixed(0)}%`;
  return formatValue(v, metric.format);
}

export function CompareChart({
  rows,
  slugs,
  names,
  metric,
  showRate,
  summary,
  loading,
}: {
  rows: ChartRow[];
  slugs: string[];
  names: Record<string, string>;
  metric: ResolvedMetric;
  showRate: boolean;
  summary: string;
  loading?: boolean;
}) {
  const c = useThemeColors();
  const reduced = usePrefersReducedMotion();
  const [table, setTable] = useState(false);
  const opts = { isRatio: metric.changeKind === 'pp' };
  // Warn when one series (usually the U.S. total) dwarfs the others on a count/level scale.
  const maxBy = slugs.map((s) =>
    Math.max(0, ...rows.map((r) => (typeof r[s] === 'number' ? (r[s] as number) : 0))),
  );
  const positive = maxBy.filter((m) => m > 0);
  const scaleGap = positive.length > 1 && Math.max(...positive) / Math.min(...positive) > 20;
  const fmt = (v: unknown) => (typeof v === 'number' ? formatValue(v, metric.format, opts) : '—');

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{metric.label}</p>
        <button
          type="button"
          className="btn text-xs"
          aria-pressed={table}
          onClick={() => setTable((t) => !t)}
        >
          {table ? 'View chart' : 'View data table'}
        </button>
      </div>
      {scaleGap && !table && (
        <p className="mb-2 text-xs text-muted" role="note">
          These series differ by more than 20×, so smaller ones look flat. Compare the YoY column below, or
          view the data table.
        </p>
      )}
      {table ? (
        <div className="table-wrap max-h-[320px] overflow-y-auto rounded-card border border-border">
          <table className="data-table num">
            <caption className="sr-only">{summary}</caption>
            <thead className="sticky top-0 bg-surface">
              <tr>
                <th scope="col">Month</th>
                {slugs.map((s) => (
                  <th scope="col" key={s}>
                    {shortName(names[s] ?? s)}
                  </th>
                ))}
                {showRate && <th scope="col">30-yr rate</th>}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.date}>
                  <th scope="row" className="font-normal">
                    {formatMonth(r.date)}
                  </th>
                  {slugs.map((s) => (
                    <td key={s}>{fmt(r[s])}</td>
                  ))}
                  {showRate && <td>{percent(r.rate as number | null)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="relative h-[320px] w-full"
          role="img"
          aria-label={summary}
          data-testid="compare-chart"
        >
          {loading && (
            <div className="absolute inset-0 z-10 animate-pulse rounded-card bg-surface-2/60" role="status">
              <span className="sr-only">Loading metro data…</span>
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: showRate ? 4 : 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={tickMonth}
                tick={{ fill: c['text-muted'], fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: c.border }}
                minTickGap={24}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(v) => compactTick(v, metric)}
                tick={{ fill: c['text-muted'], fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={56}
                domain={['auto', 'auto']}
              />
              {showRate && (
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: c['text-muted'], fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  domain={['auto', 'auto']}
                />
              )}
              <Tooltip
                contentStyle={{
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 8,
                  color: c.text,
                }}
                labelStyle={{ color: c.text, fontWeight: 600 }}
                labelFormatter={(d) => formatMonth(String(d))}
                formatter={(v, name) =>
                  name === '30-yr mortgage rate' ? [percent(v as number), name] : [fmt(v), name]
                }
              />
              <Legend wrapperStyle={{ fontSize: 12, color: c['text-muted'] }} />
              {slugs.map((s, i) => (
                <Line
                  key={s}
                  yAxisId="left"
                  type="monotone"
                  dataKey={s}
                  name={shortName(names[s] ?? s)}
                  stroke={c[LINE_COLORS[i % LINE_COLORS.length]]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={!reduced}
                />
              ))}
              {showRate && (
                <Line
                  yAxisId="rate"
                  type="stepAfter"
                  dataKey="rate"
                  name="30-yr mortgage rate"
                  stroke={c['text-muted']}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={!reduced}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
