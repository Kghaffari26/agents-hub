import type { CostSummary } from '@/lib/schemas/manifest';
import { usd } from '@/lib/format';

const NAMES: Record<string, string> = {
  real_estate: 'Real estate',
  macro: 'Macro',
  grants: 'Grants',
  repo_maint: 'Repos',
};
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

/** "This month: $X.XX across N runs" + a horizontal bar per agent (SPEC_WEBSITE §7.1). */
export function CostStrip({ costs, monthLabel }: { costs: CostSummary; monthLabel: string }) {
  const runs = costs.by_agent.reduce((s, a) => s + a.runs, 0);
  const max = Math.max(...costs.by_agent.map((a) => a.usd), 0.0001);
  return (
    <section className="card p-5" aria-labelledby="cost-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="cost-title" className="section-title">
          LLM cost transparency
        </h2>
        <p className="text-sm text-muted">
          {monthLabel}: <strong className="num text-text">{usd(costs.total_usd)}</strong> across{' '}
          <span className="num">{runs}</span> runs · all time{' '}
          <span className="num">{usd(costs.all_time_usd)}</span>
        </p>
      </div>
      <ul className="mt-4 space-y-2.5" aria-label="Cost by agent this month">
        {costs.by_agent.map((a, i) => {
          const avg = costs.avg_cost_per_run.find((x) => x.agent === a.agent)?.usd;
          return (
            <li
              key={a.agent}
              className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[110px_1fr_240px]"
            >
              <span className="truncate text-muted">{NAMES[a.agent] ?? a.agent}</span>
              <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (a.usd / max) * 100)}%`,
                    background: COLORS[i % COLORS.length],
                  }}
                />
              </span>
              <span className="num text-right">
                {usd(a.usd)}
                <span className="hidden text-muted sm:inline">
                  {' '}
                  · {a.runs} runs · {avg != null ? `$${avg.toFixed(3)}/run` : '—'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {costs.sample_agents.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Includes sample figures for agents that haven&apos;t published yet.
        </p>
      )}
    </section>
  );
}
