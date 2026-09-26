import { GitPullRequest } from 'lucide-react';
import type { Repo, StalePr } from '@/lib/schemas/repoMaint';
import { days } from '@/lib/format';
import { CiStatus } from './CiStatus';
import { CopyButton } from './CopyButton';
import { RelTime } from './RelTime';
import { REVIEW_LABEL, shortName } from './labels';

type Row = { repo: string; pr: StalePr };

/** Stale PRs with a suggested (never posted) nudge (SPEC_WEBSITE §7.5 item 4). */
export function StalePrs({ repos }: { repos: Repo[] }) {
  const rows: Row[] = repos
    .flatMap((r) => r.stale_prs.map((pr) => ({ repo: r.full_name, pr })))
    .sort((a, b) => b.pr.age_days - a.pr.age_days);
  if (!rows.length) {
    return (
      <p className="text-sm text-muted" data-testid="stale-prs">
        No stale PRs right now.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 lg:grid-cols-2" data-testid="stale-prs">
      {rows.map(({ repo, pr }) => (
        <li key={`${repo}#${pr.number}`} className="card flex min-w-0 flex-col gap-3 p-4">
          <div>
            <p className="text-xs text-muted">{repo}</p>
            <h3 className="text-base font-semibold">
              <a href={pr.url} className="link inline-flex items-start gap-1.5 break-words">
                <GitPullRequest className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <span className="num">#{pr.number}</span> {pr.title}
                </span>
              </a>
            </h3>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted">Author</dt>
              <dd className="break-words">@{pr.author}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Age</dt>
              <dd className="num">{days(pr.age_days)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Last activity</dt>
              <dd>
                <RelTime at={pr.last_activity_at} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Review</dt>
              <dd>{REVIEW_LABEL[pr.review_state]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">CI</dt>
              <dd>
                <CiStatus state={pr.ci_state} />
              </dd>
            </div>
          </dl>
          <figure className="space-y-2">
            <figcaption className="text-xs font-medium text-muted">Suggested nudge (not posted)</figcaption>
            <blockquote className="border-l-4 border-border bg-surface-2 px-3 py-2 text-sm italic">
              {pr.nudge}
            </blockquote>
            <CopyButton text={pr.nudge} srContext={`nudge for ${shortName(repo)} PR #${pr.number}`} />
          </figure>
        </li>
      ))}
    </ul>
  );
}
