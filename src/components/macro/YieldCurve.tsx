'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from 'recharts';
import { usePrefersReducedMotion, useThemeColors } from '@/lib/hooks';
import { formatDate, formatMonth, percent, ppSigned } from '@/lib/format';
import { DataTable, RangeToggle, TableToggle, tooltipStyle } from './ChartParts';
import { RANGES, sliceByYears, tickMonth, type RangeId, type YieldCurveData } from './helpers';

type Row = { date: string; y2: number | null; y10: number | null; spread: number | null };

const NAMES: Record<string, string> = { y2: '2-year', y10: '10-year', spread: '10Y–2Y spread' };

/** 2Y and 10Y yields with the 10Y–2Y spread shaded, inversion periods highlighted, plus a curve snapshot. */
export function YieldCurve({ data }: { data: YieldCurveData }) {
  const c = useThemeColors();
  const reduced = usePrefersReducedMotion();
  const [range, setRange] = useState<RangeId>('10y');
  const [table, setTable] = useState(false);
  const [snapTable, setSnapTable] = useState(false);

  const all = useMemo<Row[]>(
    () =>
      data.series.dates.map((date, i) => ({
        date,
        y2: data.series.y2[i] ?? null,
        y10: data.series.y10[i] ?? null,
        spread: data.series.spread_10y2y[i] ?? null,
      })),
    [data],
  );
  const years = RANGES.find((r) => r.id === range)?.years ?? 10;
  const rows = useMemo(() => sliceByYears(all, years), [all, years]);

  // Snap inversion periods to plotted category dates, clipped to the visible range.
  const areas = useMemo(() => {
    if (!rows.length) return [];
    const first = rows[0].date;
    const last = rows[rows.length - 1].date;
    return data.inversion_periods
      .map((p) => {
        const end = p.end ?? last;
        if (end < first || p.start > last) return null;
        const x1 = rows.find((r) => r.date >= p.start)?.date ?? first;
        const x2 = [...rows].reverse().find((r) => r.date <= end)?.date ?? last;
        return { x1, x2, ongoing: p.end == null, start: p.start, end: p.end };
      })
      .filter((a): a is NonNullable<typeof a> => a != null);
  }, [rows, data.inversion_periods]);

  const latest = [...rows].reverse().find((r) => r.spread != null);
  const summary = useMemo(() => {
    const inv = data.inversion_periods
      .map((p) => `${formatMonth(p.start)} to ${p.end ? formatMonth(p.end) : 'present'}`)
      .join('; ');
    return (
      `2-year and 10-year Treasury yields, last ${years} years, with the 10Y–2Y spread shaded. ` +
      (latest
        ? `Latest (${formatDate(latest.date)}): 2-year ${percent(latest.y2)}, 10-year ${percent(latest.y10)}, spread ${ppSigned(latest.spread)}. `
        : '') +
      (inv ? `Curve inverted ${inv}.` : 'No inversion periods.')
    );
  }, [data.inversion_periods, latest, years]);

  const snap = data.snapshot;
  const snapSummary = `Current Treasury curve: ${snap.map((s) => `${s.tenor} ${percent(s.value)}`).join(', ')}.`;
  const tip = tooltipStyle(c);
  const axisTick = { fill: c['text-muted'], fontSize: 12 };

  return (
    <section aria-labelledby="yield-curve-title" className="card p-4 md:p-5" data-testid="yield-curve">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="yield-curve-title" className="section-title">
          Yield curve
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <RangeToggle value={range} onChange={setRange} label="Yield curve range" />
          <TableToggle open={table} onToggle={() => setTable((t) => !t)} />
        </div>
      </div>
      <p className="mb-3 text-sm text-muted">
        Lines use the left axis (yield, %); the shaded area is the 10Y–2Y spread on the right axis (pp).{' '}
        {areas.length > 0 && <>Tinted bands mark inversions (spread below zero).</>}
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <div className="h-[320px] w-full" role="img" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
                {areas.map((a) => (
                  <ReferenceArea
                    key={a.start}
                    yAxisId="yield"
                    x1={a.x1}
                    x2={a.x2}
                    fill={c.bad}
                    fillOpacity={0.1}
                    stroke="none"
                    ifOverflow="hidden"
                    label={{
                      value: a.ongoing ? 'Inverted (ongoing)' : 'Inverted',
                      position: 'insideTop',
                      fill: c['text-muted'],
                      fontSize: 11,
                    }}
                  />
                ))}
                <XAxis
                  dataKey="date"
                  tickFormatter={tickMonth}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={{ stroke: c.border }}
                  minTickGap={32}
                />
                <YAxis
                  yAxisId="yield"
                  tickFormatter={(v: number) => `${v}%`}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  yAxisId="spread"
                  orientation="right"
                  tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}`}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={[
                    (min: number) => Math.min(-0.5, Math.floor(min * 2) / 2),
                    (max: number) => Math.max(1, Math.ceil(max) + 1),
                  ]}
                />
                <ReferenceLine yAxisId="spread" y={0} stroke={c['text-muted']} strokeDasharray="4 4" />
                <Tooltip
                  contentStyle={tip.contentStyle}
                  labelStyle={tip.labelStyle}
                  labelFormatter={(d) => formatDate(String(d))}
                  formatter={(v, name) => {
                    const n = typeof v === 'number' ? v : null;
                    return [name === NAMES.spread ? ppSigned(n) : percent(n), name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: c['text-muted'] }} />
                <Area
                  yAxisId="spread"
                  type="monotone"
                  dataKey="spread"
                  name={NAMES.spread}
                  stroke={c['chart-3']}
                  strokeWidth={1}
                  fill={c['chart-3']}
                  fillOpacity={0.18}
                  connectNulls={false}
                  isAnimationActive={!reduced}
                />
                <Line
                  yAxisId="yield"
                  type="monotone"
                  dataKey="y2"
                  name={NAMES.y2}
                  stroke={c['chart-2']}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={!reduced}
                />
                <Line
                  yAxisId="yield"
                  type="monotone"
                  dataKey="y10"
                  name={NAMES.y10}
                  stroke={c['chart-1']}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={!reduced}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {table && (
            <>
              <DataTable
                caption={summary}
                columns={['Week', '2-year', '10-year', '10Y–2Y']}
                rows={[...rows]
                  .reverse()
                  .slice(0, 52)
                  .map((r) => ({
                    key: r.date,
                    cells: [formatDate(r.date), percent(r.y2), percent(r.y10), ppSigned(r.spread)],
                  }))}
              />
              <p className="mt-1 text-xs text-muted">Showing the latest 52 weeks.</p>
            </>
          )}
          {data.inversion_periods.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {data.inversion_periods.map((p) => (
                <li key={p.start} className="chip">
                  Inverted {formatMonth(p.start)} – {p.end ? formatMonth(p.end) : 'present'}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Current curve</h3>
            <TableToggle open={snapTable} onToggle={() => setSnapTable((t) => !t)} />
          </div>
          <div className="h-[220px] w-full" role="img" aria-label={snapSummary}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={snap} margin={{ top: 20, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tenor" tick={axisTick} tickLine={false} axisLine={{ stroke: c.border }} />
                <YAxis
                  tickFormatter={(v: number) => `${v}%`}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  domain={[
                    (min: number) => Math.floor(min * 2) / 2 - 0.25,
                    (max: number) => Math.ceil(max * 2) / 2 + 0.25,
                  ]}
                />
                <Tooltip
                  contentStyle={tip.contentStyle}
                  labelStyle={tip.labelStyle}
                  formatter={(v) => [percent(typeof v === 'number' ? v : null), 'Yield']}
                />
                <Line
                  type="linear"
                  dataKey="value"
                  name="Yield"
                  stroke={c['chart-1']}
                  strokeWidth={2}
                  dot={{ r: 4, fill: c['chart-1'], stroke: c.surface, strokeWidth: 1.5 }}
                  connectNulls={false}
                  isAnimationActive={!reduced}
                >
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(v: unknown) => (typeof v === 'number' ? percent(v) : '')}
                    style={{ fill: c['text-muted'], fontSize: 11 }}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
          {snapTable && (
            <DataTable
              caption={snapSummary}
              columns={['Tenor', 'Yield']}
              rows={snap.map((s) => ({ key: s.tenor, cells: [s.tenor, percent(s.value)] }))}
            />
          )}
        </div>
      </div>
    </section>
  );
}
