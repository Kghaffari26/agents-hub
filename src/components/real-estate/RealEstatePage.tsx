import { Suspense } from 'react';
import type { ManifestAgent } from '@/lib/schemas/manifest';
import type { RealEstateLatest } from '@/lib/schemas/realEstate';
import { formatMonth, formatShortDate } from '@/lib/format';
import { PageHeader } from '../common/PageHeader';
import { AiBrief } from '../common/AiBrief';
import { Skeleton } from '../common/States';
import { NationalStrip } from './NationalStrip';
import { AlertsStrip } from './AlertsStrip';
import { Movers } from './Movers';
import { Explorer, type ExplorerIndex } from './Explorer';
import { REMethodology } from './REMethodology';
import { defaultSelection } from './helpers';

/** Shared by /real-estate and /real-estate/[slug]. */
export function RealEstatePage({
  index,
  agent,
  focusSlug,
  title = 'Real Estate',
}: {
  index: RealEstateLatest;
  agent: ManifestAgent;
  focusSlug?: string;
  title?: string;
}) {
  const explorerIndex: ExplorerIndex = {
    metric_registry: index.metric_registry,
    metros: index.metros,
    national: { series: index.national.series, rates: index.national.rates, latest: index.national.latest },
  };
  const defaults = {
    metros: focusSlug ? [focusSlug] : defaultSelection(index),
    metric: 'median_sale_price',
    range: '3y' as const,
    rate: false,
  };
  return (
    <div className="space-y-8">
      <PageHeader
        title={title}
        subtitle={`Market data through ${formatMonth(index.data_through)} · rates as of ${formatShortDate(index.rates_as_of)}. ${index.metros.length} U.S. metros tracked weekly from Redfin, Zillow, FRED and the Census Bureau.`}
        agent={agent}
        meta={index.meta}
        sources={index.meta.sources.map((s) => ({
          ...s,
          attribution: index.sources.find((x) => x.url === s.url)?.attribution,
        }))}
        badges={
          index.national.temperature.label ? (
            <span className="chip" title={index.national.temperature.basis ?? undefined}>
              U.S. market: {index.national.temperature.label}
              {index.national.temperature.score != null && (
                <span className="num"> · {index.national.temperature.score}</span>
              )}
            </span>
          ) : undefined
        }
      />
      <NationalStrip national={index.national} />
      <AiBrief
        title="National brief"
        text={index.national.brief.text}
        keyPoints={index.national.brief.key_points}
        citations={index.national.brief.citations}
        model={index.national.brief.model}
        generatedAt={index.national.brief.generated_at}
        narrativeSource={index.national.brief.narrative_source}
        reused={index.national.brief.reused}
      />
      <AlertsStrip alerts={index.alerts} metros={index.metros} />
      <Suspense fallback={<Skeleton className="h-[760px]" label="Loading explorer" />}>
        <Explorer
          index={explorerIndex}
          defaults={defaults}
          focusSlug={focusSlug}
          movers={<Movers movers={index.movers} />}
        />
      </Suspense>
      <REMethodology index={index} />
    </div>
  );
}
