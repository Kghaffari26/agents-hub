'use client';

import type { MetricValue } from '@/lib/schemas/realEstate';
import { changeFormat, yoyOf, type ResolvedMetric } from '@/lib/metrics';
import { formatValue } from '@/lib/format';
import { Delta } from '../common/Delta';
import { shortName } from './helpers';

type Latest = Record<string, MetricValue | undefined>;

/** Which columns are best/worst for a row, using the metric's good direction. */
export function rankRow(values: (number | null | undefined)[], dir: ResolvedMetric['goodDirection']) {
  const nums = values
    .map((v, i) => [v, i] as const)
    .filter((x): x is readonly [number, number] => x[0] != null);
  if (nums.length < 2) return { hi: -1, lo: -1 };
  const max = nums.reduce((a, b) => (b[0] > a[0] ? b : a));
  const min = nums.reduce((a, b) => (b[0] < a[0] ? b : a));
  if (max[0] === min[0]) return { hi: -1, lo: -1 };
  if (dir === 'down') return { hi: min[1], lo: max[1] };
  return { hi: max[1], lo: min[1] };
}

/**
 * One column per selected metro, one row per metric: latest value and YoY. Best/worst per
 * row get a subtle highlight; for neutral metrics that's simply the highest/lowest.
 */
export function MetroTable({
  slugs,
  names,
  latest,
  metrics,
  activeMetric,
}: {
  slugs: string[];
  names: Record<string, string>;
  latest: Record<string, Latest | undefined>;
  metrics: ResolvedMetric[];
  activeMetric: string;
}) {
  return (
    <div className="table-wrap rounded-card border border-border">
      <table className="data-table num" data-testid="metro-table">
        <caption className="sr-only">Latest value and year-over-year change by metro</caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            {slugs.map((s) => (
              <th scope="col" key={s} className="min-w-[120px]">
                {shortName(names[s] ?? s)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => {
            const opts = { isRatio: m.changeKind === 'pp' };
            const vals = slugs.map((s) => latest[s]?.[m.key]?.value);
            const { hi, lo } = rankRow(vals, m.goodDirection);
            const neutral = m.goodDirection === 'neutral';
            return (
              <tr key={m.key} className={m.key === activeMetric ? 'bg-surface-2/60' : undefined}>
                <th scope="row" className="font-medium">
                  {m.label}
                </th>
                {slugs.map((s, i) => {
                  const v = latest[s]?.[m.key];
                  // Neutral metrics (most housing metrics) have no "better" side, so no highlight.
                  const mark = neutral ? null : i === hi ? 'Best' : i === lo ? 'Worst' : null;
                  const tone = mark ? (i === hi ? 'bg-good/10' : 'bg-bad/10') : '';
                  return (
                    <td key={s} className={tone}>
                      <span className="block font-medium">{formatValue(v?.value, m.format, opts)}</span>
                      <span className="block text-xs">
                        <Delta
                          value={yoyOf(v)}
                          format={changeFormat(m)}
                          goodDirection={m.goodDirection}
                          opts={opts}
                          suffix="YoY"
                        />
                      </span>
                      {mark && (
                        <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-muted">
                          {mark}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
