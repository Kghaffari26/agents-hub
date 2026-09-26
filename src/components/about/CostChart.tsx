import type { CostSummary } from '@/lib/schemas/manifest';
import { formatShortDate, usd } from '@/lib/format';

const NAMES: Record<string, string> = {
  real_estate: 'Real estate',
  macro: 'Macro',
  grants: 'Grants',
  repo_maint: 'Repos',
};

/** Daily LLM spend this month (SVG bars) + cost per run by agent. */
export function CostChart({ costs }: { costs: CostSummary }) {
  const W = 720;
  const H = 180;
  const max = Math.max(...costs.daily.map((d) => d.usd), 0.01);
  const bw = costs.daily.length ? W / costs.daily.length : W;
  const total = costs.daily.reduce((s, d) => s + d.usd, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <figure className="card p-4">
        <figcaption className="mb-2 text-sm font-medium">
          Daily LLM spend, all agents ({costs.month})
        </figcaption>
        <svg
          viewBox={`0 0 ${W} ${H + 20}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Daily LLM spend in ${costs.month}: ${costs.daily.length} days, ${usd(total)} total, peak ${usd(max)}.`}
        >
          <line x1="0" x2={W} y1={H} y2={H} stroke="var(--border)" />
          {costs.daily.map((d, i) => {
            const h = (d.usd / max) * (H - 10);
            return (
              <rect
                key={d.date}
                x={i * bw + 2}
                y={H - h}
                width={Math.max(bw - 4, 1)}
                height={h}
                rx={2}
                fill="var(--chart-1)"
              >
                <title>{`${formatShortDate(d.date)}: ${usd(d.usd)}`}</title>
              </rect>
            );
          })}
          {costs.daily.length > 0 && (
            <>
              <text x="0" y={H + 16} fontSize="12" fill="var(--text-muted)">
                {formatShortDate(costs.daily[0].date)}
              </text>
              <text x={W} y={H + 16} fontSize="12" fill="var(--text-muted)" textAnchor="end">
                {formatShortDate(costs.daily[costs.daily.length - 1].date)}
              </text>
            </>
          )}
        </svg>
      </figure>
      <div className="card p-4">
        <table className="data-table num">
          <caption className="mb-2 text-left text-sm font-medium">By agent this month</caption>
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Spend</th>
              <th scope="col">Runs</th>
              <th scope="col">Per run</th>
            </tr>
          </thead>
          <tbody>
            {costs.by_agent.map((a) => (
              <tr key={a.agent}>
                <th scope="row" className="font-medium">
                  {NAMES[a.agent] ?? a.agent}
                </th>
                <td>{usd(a.usd)}</td>
                <td>{a.runs}</td>
                <td>${(costs.avg_cost_per_run.find((x) => x.agent === a.agent)?.usd ?? 0).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm text-muted">
          Total {usd(costs.total_usd)} this month · {usd(costs.all_time_usd)} all time.
        </p>
      </div>
    </div>
  );
}
