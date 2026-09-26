import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { getAgent, getGrantsLatest } from '@/lib/data/server';
import { canonical } from '@/lib/data/url';
import { ogImages } from '@/lib/data/url';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { ProfileChip } from '@/components/grants/ProfileChip';
import { TopMatches, topByFit } from '@/components/grants/TopMatches';
import { GrantsTable } from '@/components/grants/GrantsTable';
import { DeadlineTimeline } from '@/components/grants/DeadlineTimeline';
import { GrantsMethodology, ProfileSection } from '@/components/grants/GrantsMethodology';

export function generateMetadata(): Metadata {
  const data = getGrantsLatest();
  const n = data.stats.new_since_last_run;
  return {
    title: `Grants & contracts — ${n} new match${n === 1 ? '' : 'es'} today`,
    description: data.headline,
    alternates: { canonical: canonical('/grants/') },
    ...ogImages('grants'),
  };
}

export default function GrantsPage() {
  const data = getGrantsLatest();
  const agent = getAgent('grants');
  const { stats } = data;
  const top = topByFit(data.top_matches);
  const sources = data.meta.sources.length ? data.meta.sources : data.sources;

  return (
    <div className="space-y-10 pb-4">
      <PageHeader
        title="Grants & Contracts"
        subtitle={data.headline}
        agent={agent}
        meta={data.meta}
        sources={sources}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ProfileChip profile={data.profile} />
        </div>
        {data.meta.sam_budget_exhausted && (
          <p className="flex items-start gap-1.5 text-sm text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            The SAM.gov daily request budget ran out during this run, so some contract descriptions
            weren&apos;t fetched; affected scores may be less precise.
          </p>
        )}
      </PageHeader>

      <section aria-label="Summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New since last run" value={stats.new_since_last_run} format="count" />
        <StatCard label="Closing within 14 days" value={stats.closing_within_14d} format="count" />
        <StatCard
          label="Active matches"
          value={stats.active_matches}
          format="count"
          footnote={`Relevance ≥ ${data.thresholds.relevance}`}
        />
        <StatCard
          label="Largest disclosed value"
          value={stats.largest_value?.amount ?? null}
          format="currency_compact"
          footnote={stats.largest_value ? stats.largest_value.title : 'No values disclosed'}
        />
      </section>

      <TopMatches matches={data.top_matches} total={data.top_matches.length} />

      <DeadlineTimeline items={data.deadlines_30d} topIds={top.map((m) => m.id)} />

      <GrantsTable topMatches={data.top_matches} />

      <ProfileSection profile={data.profile} />

      <GrantsMethodology data={data} />
    </div>
  );
}
