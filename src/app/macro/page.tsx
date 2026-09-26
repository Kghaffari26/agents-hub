import type { Metadata } from 'next';
import { getAgent, getMacro } from '@/lib/data/server';
import { canonical } from '@/lib/data/url';
import { ogImages } from '@/lib/data/url';
import { PageHeader } from '@/components/common/PageHeader';
import { AiBrief } from '@/components/common/AiBrief';
import { RegimeStrip } from '@/components/macro/RegimeStrip';
import { IndicatorGrid } from '@/components/macro/IndicatorGrid';
import { LazyYieldCurve as YieldCurve } from '@/components/macro/LazyYieldCurve';
import { FomcPanel } from '@/components/macro/FomcPanel';
import { ReleaseCalendar } from '@/components/macro/ReleaseCalendar';
import { MacroMethodology } from '@/components/macro/MacroMethodology';
import { fmtValue, stripSeries } from '@/components/macro/helpers';

export function generateMetadata(): Metadata {
  const data = getMacro();
  const cpi =
    data.indicators.find((i) => i.id === 'cpi') ?? data.indicators.find((i) => i.fred_series === 'CPIAUCSL');
  const title =
    cpi && cpi.primary.value != null
      ? `Macro dashboard — CPI ${fmtValue(cpi.primary.value, cpi.primary.format)} ${cpi.primary.label} (${cpi.period_label})`
      : 'Macro dashboard';
  return {
    title,
    description: data.headline,
    alternates: { canonical: canonical('/macro/') },
    ...ogImages('macro', title, data.headline),
  };
}

export default function MacroPage() {
  const data = getMacro();
  const agent = getAgent('macro');
  // Keep the page HTML small: cards get sparklines only; full series load on expand.
  const indicators = data.indicators.map(stripSeries);
  const names = Object.fromEntries(data.indicators.map((i) => [i.id, i.name]));

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        title="Macro & Fed"
        subtitle={data.headline}
        agent={agent}
        meta={data.meta}
        sources={data.meta.sources}
      />
      <RegimeStrip regimes={data.regimes} />
      <AiBrief
        title="What changed"
        bullets={data.brief.bullets}
        model={data.brief.model}
        generatedAt={data.brief.generated_at}
        narrativeSource={data.brief.narrative_source}
        reused={!!data.brief.reused_from_run_id}
      />
      <IndicatorGrid indicators={indicators} />
      <YieldCurve data={data.yield_curve} />
      <FomcPanel fomc={data.fomc} />
      <ReleaseCalendar calendar={data.calendar} nextMeeting={data.fomc.next_meeting} names={names} />
      <MacroMethodology events={data.events} />
    </div>
  );
}
