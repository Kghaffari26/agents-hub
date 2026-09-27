'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useJson } from '@/lib/data/client';
import { evalsData } from '@/lib/schemas/agentic';
import { usePrefersReducedMotion, useThemeColors } from '@/lib/hooks';
import { formatShortDate, score } from '@/lib/format';
import { ErrorState, Skeleton } from '@/components/common/States';
import { Segmented } from '@/components/common/Segmented';
import { DataTable, TableToggle, tooltipStyle } from '@/components/macro/ChartParts';
import { bySuite, chartRows, scoreLabel } from './evalsModel';

const COLORS = ['chart-1', 'chart-2', 'chart-3', 'chart-4'] as const;
// Dash patterns so lines differ by more than color.
const DASH = ['', '6 3', '2 3', '10 3 2 3'];

/** Eval scores over time for one source (loads public/data/evals/<id>.json on the client). */
export function EvalsChart({ id, height = 260 }: { id: string; height?: number }) {
  const res = useJson(`evals/${id}.json`, evalsData);
  if (res.status === 'loading') return <Skeleton className="h-[260px] w-full" label="Loading eval history" />;
  if (res.status === 'error') return <ErrorState message="Eval history didn't load." />;
  return <SuiteCharts name={res.data.name} entries={res.data.entries} height={height} />;
}

function SuiteCharts({
  name,
  entries,
  height,
}: {
  name: string;
  entries: Parameters<typeof bySuite>[0];
  height: number;
}) {
  const suites = useMemo(() => bySuite(entries), [entries]);
  const names = [...suites.keys()];
  const [suite, setSuite] = useState(names[0]);
  const [table, setTable] = useState(false);
  const c = useThemeColors();
  const reduced = usePrefersReducedMotion();
  const list = useMemo(() => suites.get(suite) ?? [], [suites, suite]);
  const rows = useMemo(() => chartRows(list), [list]);
  const keys = rows.length ? Object.keys(rows[rows.length - 1]).filter((k) => k !== 'ts') : [];
  const summary = rows.length
    ? `${name}, ${suite} eval: ${rows.length} run${rows.length === 1 ? '' : 's'} from ${formatShortDate(rows[0].ts)} to ${formatShortDate(
        rows[rows.length - 1].ts,
      )}. Latest: ${keys.map((k) => `${scoreLabel(k)} ${score(rows[rows.length - 1][k])}`).join(', ')}.`
    : `${name}: no eval runs yet.`;
  const tip = tooltipStyle(c);
  if (!names.length) return <p className="text-sm text-muted">No eval runs yet.</p>;
  return (
    <div data-testid="evals-chart">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {names.length > 1 ? (
          <Segmented
            label={`${name} eval suite`}
            size="sm"
            value={suite}
            onChange={setSuite}
            options={names.map((n) => ({ value: n, label: scoreLabel(n) }))}
          />
        ) : (
          <p className="text-sm font-medium">{scoreLabel(suite)}</p>
        )}
        <TableToggle open={table} onToggle={() => setTable((t) => !t)} />
      </div>
      <div className="w-full" style={{ height }} role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ts"
              tickFormatter={(d: string) => formatShortDate(d)}
              tick={{ fill: c['text-muted'], fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: c.border }}
              minTickGap={24}
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tickFormatter={(v: number) => score(v)}
              tick={{ fill: c['text-muted'], fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              contentStyle={tip.contentStyle}
              labelStyle={tip.labelStyle}
              labelFormatter={(d) => formatShortDate(String(d))}
              formatter={(v, k) => [score(typeof v === 'number' ? v : null), scoreLabel(String(k))]}
            />
            <Legend
              formatter={(k: string) => <span style={{ color: c.text, fontSize: 12 }}>{scoreLabel(k)}</span>}
              iconType="plainline"
            />
            {keys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={c[COLORS[i % COLORS.length]]}
                strokeDasharray={DASH[i % DASH.length]}
                strokeWidth={2}
                dot={{ r: 2.5 }}
                isAnimationActive={!reduced}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {table && (
        <DataTable
          caption={summary}
          columns={['Run', ...keys.map(scoreLabel), 'Model', 'Prompt']}
          rows={[...list].reverse().map((e, i) => {
            const r = rows[rows.length - 1 - i];
            return {
              key: `${e.ts}-${i}`,
              cells: [
                formatShortDate(e.ts),
                ...keys.map((k) => score(r[k] ?? null)),
                e.model ?? '—',
                e.prompt_version ?? '—',
              ],
            };
          })}
        />
      )}
    </div>
  );
}
