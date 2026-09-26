import { AlertTriangle, ExternalLink, Info } from 'lucide-react';
import type { Repo } from '@/lib/schemas/repoMaint';
import { count, days } from '@/lib/format';
import { HealthBreakdown } from './HealthBreakdown';
import { ActivityChart } from './ActivityChart';
import { CiStatus } from './CiStatus';
import { ROLE_LABEL, formatHours } from './labels';

function Stat({
  label,
  children,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-md px-2 py-1.5 ${highlight ? 'border border-neutral bg-surface-2' : ''}`}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num font-semibold">{children}</dd>
    </div>
  );
}

/** One watched repo: health grade, counts, CI and 12-week activity (SPEC_WEBSITE §7.5). */
export function RepoCard({ repo }: { repo: Repo }) {
  const headingId = `repo-${repo.full_name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const c = repo.counts;
  return (
    <article
      className="card flex min-w-0 flex-col gap-4 p-4 md:p-5"
      data-testid="repo-card"
      aria-labelledby={headingId}
    >
      <div className="space-y-1.5">
        <h3 id={headingId} className="break-words text-base font-semibold">
          <a href={repo.url} className="link inline-flex items-center gap-1">
            {repo.full_name}
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip" data-role={repo.role}>
            {ROLE_LABEL[repo.role]}
          </span>
          {repo.partial && (
            <span
              className="chip border-neutral text-neutral"
              title="Some requests failed or hit a limit; counts may be incomplete."
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Partial data
            </span>
          )}
        </div>
        {repo.role === 'public_demo' && (
          <p className="flex items-start gap-1 text-xs text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Not affiliated; read-only demo. Independent analysis of public data; the agent never writes here.
          </p>
        )}
      </div>

      <HealthBreakdown health={repo.health} repoName={repo.full_name} />

      <dl className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
        <Stat label="Open issues">{count(c.open_issues)}</Stat>
        <Stat label="Untriaged" highlight={c.untriaged > 0}>
          {count(c.untriaged)}
          {c.untriaged_over_7d > 0 && (
            <span className="block text-xs font-normal text-muted">
              {count(c.untriaged_over_7d)} over 7 days
            </span>
          )}
        </Stat>
        <Stat label="Open PRs">{count(c.open_prs)}</Stat>
        <Stat label="Stale PRs">{count(c.stale_prs)}</Stat>
        <Stat label="Median first response">{formatHours(repo.median_first_response_hours)}</Stat>
        <Stat label="Awaiting first reply">{count(c.no_response_count)}</Stat>
        <Stat label="Default-branch CI">
          <CiStatus state={repo.ci_default_branch} />
        </Stat>
        <Stat label="Since last release">{days(repo.days_since_release)}</Stat>
      </dl>

      <ActivityChart activity={repo.activity_12w} repoName={repo.full_name} />
    </article>
  );
}
