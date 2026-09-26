'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { MetroSummary, RealEstateLatest } from '@/lib/schemas/realEstate';
import { changeFormat, resolveRegistry, toggleMetrics } from '@/lib/metrics';
import { addMetro, RANGES, US, type ExplorerState, type ParseContext, type Range } from '@/lib/urlState';
import { useThemeColors } from '@/lib/hooks';
import { Segmented } from '../common/Segmented';
import { ErrorState, Skeleton } from '../common/States';
import { WhenVisible } from '../common/WhenVisible';
import { MetroPicker } from './MetroPicker';
import { MetroTable } from './MetroTable';
import { TemperatureRow } from './Temperature';
import { MetroBriefs } from './MetroBriefs';
import { MapSection } from './MapSection';
import { AffordabilityCalc } from './AffordabilityCalc';
import { buildChartRows, chartSummary, LINE_COLORS, metroName, monthlyRates, US_LABEL } from './helpers';
import { useExplorerState } from './useExplorerState';
import { useMetroDetails } from './useMetroDetails';

// Recharts is the heaviest dependency; load it after first paint (height is reserved).
const CompareChart = dynamic(() => import('./CompareChart').then((m) => m.CompareChart), {
  ssr: false,
  loading: () => <Skeleton className="mt-8 h-[320px]" label="Loading chart" />,
});

export type ExplorerIndex = Pick<RealEstateLatest, 'metric_registry' | 'metros'> & {
  national: Pick<RealEstateLatest['national'], 'series' | 'rates' | 'latest'>;
};

/** The interactive core of /real-estate (SPEC_WEBSITE §7.2 items 5, 6 and 8). */
export function Explorer({
  index,
  defaults,
  focusSlug,
  movers,
}: {
  index: ExplorerIndex;
  defaults: ExplorerState;
  focusSlug?: string;
  movers?: React.ReactNode;
}) {
  const colors = useThemeColors();
  const resolved = useMemo(() => resolveRegistry(index.metric_registry), [index.metric_registry]);
  const toggles = useMemo(() => toggleMetrics(resolved), [resolved]);
  const ctx: ParseContext = useMemo(
    () => ({
      knownSlugs: new Set(index.metros.map((m) => m.slug)),
      metricKeys: toggles.map((m) => m.key),
      defaults,
    }),
    [index.metros, toggles, defaults],
  );
  const [state, update] = useExplorerState(ctx);
  const details = useMetroDetails(state.metros);
  const loaded = Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v.data]));
  const metric = toggles.find((m) => m.key === state.metric) ?? toggles[0];
  const names: Record<string, string> = Object.fromEntries(
    state.metros.map((s) => [s, metroName(s, index.metros)]),
  );
  const rates = useMemo(
    () =>
      state.rate ? monthlyRates(index.national.rates.dates, index.national.rates.mortgage30) : undefined,
    [state.rate, index.national.rates],
  );
  const rows = useMemo(
    () => buildChartRows(state.metros, metric.key, state.range, loaded, index.national.series, rates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.metros, metric.key, state.range, details, index.national.series, rates],
  );
  const loading = state.metros.some(
    (s) => s !== US && details[s]?.status !== 'ok' && details[s]?.status !== 'error',
  );
  const failed = state.metros.filter((s) => details[s]?.status === 'error');
  const lineColors = state.metros.map((_, i) => colors[LINE_COLORS[i % LINE_COLORS.length]]);
  const summary = chartSummary(rows, state.metros, names, metric, state.range, changeFormat(metric));
  const usMissing = state.metros.includes(US) && !(metric.key in index.national.series);

  // Stat table: metro files' `latest`, or the national latest for "us".
  const latestBySlug = Object.fromEntries(
    state.metros.map((s) => [s, s === US ? index.national.latest : loaded[s]?.latest]),
  );
  const selectedDetails = state.metros.map((s) => loaded[s]).filter((d): d is NonNullable<typeof d> => !!d);
  const calcSlug =
    state.metros.find((s) => s !== US) ?? defaults.metros.find((s) => s !== US) ?? index.metros[0].slug;
  const pickerOptions = useMemo(
    () =>
      [...index.metros]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m: MetroSummary) => ({ slug: m.slug, name: m.name })),
    [index.metros],
  );

  return (
    <>
      <section aria-labelledby="explorer-title" className="card space-y-5 p-4 md:p-5" data-testid="explorer">
        <div>
          <h2 id="explorer-title" className="section-title">
            Metro explorer
          </h2>
          <p className="text-sm text-muted">
            Compare up to three metros (or the U.S.). The view is saved in the URL, so you can share it.
          </p>
        </div>
        <MetroPicker
          options={pickerOptions}
          selected={state.metros}
          onChange={(m) => update({ metros: m })}
          colors={lineColors}
        />
        <div className="space-y-3">
          <Segmented
            label="Metric"
            testId="metric-toggle"
            options={toggles.map((m) => ({ value: m.key, label: m.short }))}
            value={metric.key}
            onChange={(v) => update({ metric: v })}
          />
          <div className="flex flex-wrap items-center gap-4">
            <Segmented
              label="Time range"
              testId="range-toggle"
              size="sm"
              options={RANGES.map((r) => ({ value: r, label: r.toUpperCase() }))}
              value={state.range}
              onChange={(v) => update({ range: v as Range })}
            />
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.rate}
                onChange={(e) => update({ rate: e.target.checked })}
                data-testid="rate-overlay"
                className="h-4 w-4 accent-[color:var(--accent)]"
              />
              Show 30-yr mortgage rate
            </label>
          </div>
        </div>
        {failed.length > 0 && <ErrorState />}
        {usMissing && (
          <p className="text-sm text-muted">
            {US_LABEL}: no national series for {metric.label.toLowerCase()}; showing metros only.
          </p>
        )}
        {state.metros.length === 0 ? (
          <p className="rounded-card border border-dashed border-border p-8 text-center text-sm text-muted">
            Pick a metro above to start comparing.
          </p>
        ) : (
          <>
            <WhenVisible placeholder={<Skeleton className="mt-8 h-[320px]" label="Loading chart" />}>
              <CompareChart
                rows={rows}
                slugs={state.metros}
                names={names}
                metric={metric}
                showRate={state.rate}
                summary={summary}
                loading={loading}
              />
            </WhenVisible>
            <MetroTable
              slugs={state.metros}
              names={names}
              latest={latestBySlug}
              metrics={toggles}
              activeMetric={metric.key}
            />
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Market temperature</h3>
              <TemperatureRow slugs={state.metros} details={loaded} />
              {state.metros.includes(US) && (
                <p className="text-xs text-muted">
                  The U.S. temperature is shown in the national strip above.
                </p>
              )}
            </div>
            {selectedDetails.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Metro briefs</h3>
                <MetroBriefs details={selectedDetails} initial={focusSlug} />
              </div>
            )}
          </>
        )}
      </section>
      <MapSection
        metros={index.metros}
        metric={metric}
        selected={state.metros}
        onSelect={(slug) => update({ metros: addMetro(state.metros, slug) })}
      />
      {movers}
      <AffordabilityCalc
        metros={pickerOptions}
        initialSlug={calcSlug}
        defaults={{ rate: index.national.rates.latest.mortgage30 ?? 6.5 }}
      />
    </>
  );
}
