'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useJson } from '@/lib/data/client';
import { macroLatest } from '@/lib/schemas/macro';
import { usePrefersReducedMotion, useThemeColors } from '@/lib/hooks';
import { formatDate } from '@/lib/format';
import { ErrorState, Skeleton } from '@/components/common/States';
import { DataTable, RangeToggle, TableToggle, tooltipStyle } from './ChartParts';
import {
  RANGES,
  axisTick,
  fmtValue,
  sliceByYears,
  tickMonth,
  type IndicatorLite,
  type RangeId,
} from './helpers';

type Series = { dates: string[]; values: (number | null)[] };

/** Expanded indicator chart. Loads the full series lazily unless one is passed in. */
export function IndicatorChart({ indicator, series }: { indicator: IndicatorLite; series?: Series }) {
  // Only fetch the full file when no series was handed in (the page never passes one).
  const res = useJson(series ? null : 'macro/latest.json', macroLatest);
  const full =
    series ??
    (res.status === 'ok' ? res.data.indicators.find((i) => i.id === indicator.id)?.series : undefined);

  if (!full) {
    if (!series && res.status === 'error') return <ErrorState />;
    if (!series && res.status === 'ok')
      return <ErrorState message="No history is published for this indicator." />;
    return <Skeleton className="h-[300px] w-full" label="Loading chart" />;
  }
  return <SeriesChart indicator={indicator} series={full} />;
}

function SeriesChart({ indicator, series }: { indicator: IndicatorLite; series: Series }) {
  const c = useThemeColors();
  const reduced = usePrefersReducedMotion();
  const [range, setRange] = useState<RangeId>('5y');
  const [table, setTable] = useState(false);
  const fmt = indicator.primary.format;

  const allRows = useMemo(
    () => series.dates.map((date, i) => ({ date, value: series.values[i] ?? null })),
    [series],
  );
  const years = RANGES.find((r) => r.id === range)?.years ?? 5;
  const rows = useMemo(() => sliceByYears(allRows, years), [allRows, years]);

  const summary = useMemo(() => {
    const vals = rows.filter((r): r is { date: string; value: number } => r.value != null);
    if (!vals.length) return `${indicator.name}: no data in the last ${years} years.`;
    const first = vals[0];
    const last = vals[vals.length - 1];
    const hi = vals.reduce((a, b) => (b.value > a.value ? b : a));
    const lo = vals.reduce((a, b) => (b.value < a.value ? b : a));
    return `${indicator.name} (${indicator.primary.label}), last ${years} years: from ${fmtValue(first.value, fmt)} in ${tickMonth(
      first.date,
    )} to ${fmtValue(last.value, fmt)} in ${tickMonth(last.date)}; high ${fmtValue(hi.value, fmt)}, low ${fmtValue(lo.value, fmt)}.`;
  }, [rows, indicator, years, fmt]);

  const crossesZero =
    rows.some((r) => r.value != null && r.value < 0) && rows.some((r) => r.value != null && r.value > 0);
  const tip = tooltipStyle(c);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {indicator.primary.label}
          <span className="text-muted"> · {indicator.units_display}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <RangeToggle value={range} onChange={setRange} label={`${indicator.name} chart range`} />
          <TableToggle open={table} onToggle={() => setTable((t) => !t)} />
        </div>
      </div>
      <div className="h-[300px] w-full" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={tickMonth}
              tick={{ fill: c['text-muted'], fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: c.border }}
              minTickGap={32}
            />
            <YAxis
              tickFormatter={(v: number) => axisTick(v, fmt)}
              tick={{ fill: c['text-muted'], fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={52}
              domain={['auto', 'auto']}
            />
            {crossesZero && <ReferenceLine y={0} stroke={c['text-muted']} strokeDasharray="4 4" />}
            <Tooltip
              contentStyle={tip.contentStyle}
              labelStyle={tip.labelStyle}
              labelFormatter={(d) => formatDate(String(d))}
              formatter={(v) => [fmtValue(typeof v === 'number' ? v : null, fmt), indicator.primary.label]}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={indicator.primary.label}
              stroke={c['chart-1']}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={!reduced}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {table && (
        <DataTable
          caption={summary}
          columns={['Date', indicator.primary.label]}
          rows={[...rows]
            .reverse()
            .slice(0, 60)
            .map((r) => ({ key: r.date, cells: [formatDate(r.date), fmtValue(r.value, fmt)] }))}
        />
      )}
      {table && rows.length > 60 && (
        <p className="mt-1 text-xs text-muted">Showing the latest 60 of {rows.length} observations.</p>
      )}
    </div>
  );
}
