import Link from 'next/link';
import { ArrowRight, Building2, Gauge, GitPullRequest, Landmark } from 'lucide-react';
import type { ManifestAgent } from '@/lib/schemas/manifest';
import { LiveStatusBadge } from '../common/LiveStatus';
import { LastUpdated } from '../common/LastUpdated';
import { StatCard } from '../common/StatCard';
import { SampleBadge } from '../common/SampleBadge';

const ICONS: Record<string, typeof Building2> = {
  real_estate: Building2,
  macro: Gauge,
  grants: Landmark,
  repo_maint: GitPullRequest,
};

export function AgentCard({ agent }: { agent: ManifestAgent }) {
  const Icon = ICONS[agent.id] ?? Gauge;
  const href = agent.route.endsWith('/') ? agent.route : `${agent.route}/`;
  return (
    <article
      className="card flex flex-col gap-4 p-5"
      data-testid={`agent-card-${agent.id}`}
      aria-labelledby={`card-${agent.id}`}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`card-${agent.id}`} className="text-base font-semibold">
              {agent.name}
            </h2>
            <LiveStatusBadge
              status={agent.status}
              lastRunAt={agent.last_run_at}
              intervalHours={agent.expected_interval_hours}
            />
            {agent.sample && <SampleBadge repo={agent.repo} />}
          </div>
          <LastUpdated
            at={agent.last_run_at}
            dataChangedAt={agent.last_data_change_at}
            intervalHours={agent.expected_interval_hours}
            compact
          />
        </div>
      </div>
      <p className="leading-relaxed">{agent.headline}</p>
      {agent.key_stats.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {agent.key_stats.slice(0, 2).map((s) => (
            <StatCard
              key={s.label}
              size="sm"
              label={s.label}
              value={s.value}
              format={s.format}
              delta={s.delta ?? undefined}
              deltaFormat={s.delta_format}
              goodDirection={s.good_direction}
            />
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">Next run: {agent.next_run_hint}</span>
        <Link
          href={href}
          className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
        >
          Open <span className="sr-only">{agent.name}</span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
