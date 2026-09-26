import type { Metadata } from 'next';
import { getAgent, getRepoMaint } from '@/lib/data/server';
import { canonical } from '@/lib/data/url';
import { ogImages } from '@/lib/data/url';
import { count } from '@/lib/format';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionHeading } from '@/components/common/Methodology';
import { StatCard } from '@/components/common/StatCard';
import { ModeBadge } from '@/components/repos/ModeBadge';
import { RepoCard } from '@/components/repos/RepoCard';
import { TriageTable } from '@/components/repos/TriageTable';
import { StalePrs } from '@/components/repos/StalePrs';
import { ChangelogDraft } from '@/components/repos/ChangelogDraft';
import { ActionsLog } from '@/components/repos/ActionsLog';
import { RepoMethodology } from '@/components/repos/RepoMethodology';
import { MODE_EXPLANATION, avgHealth, shortName } from '@/components/repos/labels';

export function generateMetadata(): Metadata {
  const data = getRepoMaint();
  const n = data.repos.length;
  const avg = avgHealth(data.repos);
  return {
    title: `Repo maintenance — ${n} ${n === 1 ? 'repo' : 'repos'}${avg != null ? `, avg health ${avg}` : ''}`,
    description: data.headline,
    alternates: { canonical: canonical('/repos/') },
    ...ogImages('repos'),
  };
}

export default function ReposPage() {
  const data = getRepoMaint();
  const agent = getAgent('repo_maint');
  const { meta, repos, mode } = data;
  const withChangelog = repos.flatMap((r) =>
    r.changelog ? [{ name: r.full_name, changelog: r.changelog }] : [],
  );
  const withoutChangelog = repos.filter((r) => !r.changelog);
  const cacheNote =
    meta.github_requests != null
      ? `${count(meta.github_requests)} GitHub API requests this run${
          meta.github_304s != null
            ? `, ${count(meta.github_304s)} answered from cache (304 Not Modified)`
            : ''
        }.`
      : null;

  return (
    <div className="space-y-10 pb-4">
      <PageHeader
        title="Repo Maintenance"
        subtitle={data.headline}
        agent={agent}
        meta={meta}
        sources={meta.sources}
        badges={<ModeBadge mode={mode} />}
      >
        <p className="max-w-3xl text-sm text-muted">{MODE_EXPLANATION[mode]}</p>
        {cacheNote && <p className="text-xs text-muted">{cacheNote}</p>}
      </PageHeader>

      {data.key_stats.length > 0 && (
        <section aria-label="Key stats" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.key_stats.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              format={s.format}
              delta={s.delta ?? undefined}
              deltaFormat={s.delta_format}
              goodDirection={s.good_direction}
            />
          ))}
        </section>
      )}

      <section aria-labelledby="repos-heading">
        <SectionHeading id="repos-heading">Repos</SectionHeading>
        <p className="mb-3 text-sm text-muted">
          Hover, focus or tap a grade to see the penalties behind it. Untriaged counts are outlined.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {repos.map((r) => (
            <RepoCard key={r.full_name} repo={r} />
          ))}
        </div>
      </section>

      <section aria-labelledby="triage-heading">
        <SectionHeading id="triage-heading">Triage queue</SectionHeading>
        <p className="mb-3 text-sm text-muted">
          Untriaged issues with the agent&apos;s suggested type, labels and priority. Suggestions may be
          wrong.
        </p>
        <TriageTable repos={repos} mode={mode} />
      </section>

      <section aria-labelledby="stale-heading">
        <SectionHeading id="stale-heading">Stale PRs</SectionHeading>
        <StalePrs repos={repos} />
      </section>

      <section aria-labelledby="changelog-heading">
        <SectionHeading id="changelog-heading">Changelog drafts</SectionHeading>
        {withChangelog.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {withChangelog.map((r) => (
              <ChangelogDraft key={r.name} repoName={r.name} changelog={r.changelog} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No changelog drafts this run.</p>
        )}
        {withoutChangelog.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            No release base yet: {withoutChangelog.map((r) => shortName(r.full_name)).join(', ')}.
          </p>
        )}
      </section>

      <section aria-labelledby="actions-heading">
        <SectionHeading id="actions-heading">Actions log</SectionHeading>
        <ActionsLog actions={data.actions} mode={mode} />
      </section>

      <RepoMethodology />
    </div>
  );
}
