'use client';

import { ChevronDown, ExternalLink } from 'lucide-react';
import { Delta } from '@/components/common/Delta';
import { Sparkline } from '@/components/common/Sparkline';
import { formatDate, formatShortDate } from '@/lib/format';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/common/States';

// Recharts loads only when a card is expanded.
const IndicatorChart = dynamic(() => import('./IndicatorChart').then((m) => m.IndicatorChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[300px]" label="Loading chart" />,
});
import { fmtValue, revisionText, scaleForFormat, type IndicatorLite } from './helpers';

export interface IndicatorCardProps {
  indicator: IndicatorLite;
  expanded: boolean;
  onToggle: () => void;
  /** Full series, when already in hand (tests); otherwise loaded lazily on expand. */
  series?: { dates: string[]; values: (number | null)[] };
}

/** One indicator: value, change, secondary values, sparkline, badges; expands into a chart. */
export function IndicatorCard({ indicator: ind, expanded, onToggle, series }: IndicatorCardProps) {
  const panelId = `indicator-panel-${ind.id}`;
  const titleId = `indicator-title-${ind.id}`;
  const spark = ind.spark.values;
  return (
    <article
      className={`card flex flex-col ${expanded ? 'col-span-full' : ''}`}
      data-testid={`indicator-card-${ind.id}`}
      aria-labelledby={titleId}
    >
      {/* The heading button's ::after stretches over this block, so the whole summary is clickable. */}
      <div className="relative flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 id={titleId} className="text-sm font-semibold leading-snug">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={onToggle}
              className="text-left after:absolute after:inset-0 after:rounded-card after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
            >
              {ind.name}
              <span className="sr-only">{expanded ? ' — hide chart' : ' — show chart'}</span>
            </button>
          </h3>
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="num text-xl font-semibold">{fmtValue(ind.primary.value, ind.primary.format)}</p>
            <p className="text-xs text-muted">
              {ind.primary.label} · {ind.period_label}
            </p>
          </div>
          <Sparkline data={spark} width={96} height={32} label={`${ind.name}, recent trend`} />
        </div>

        {ind.change && (
          <p className="text-sm">
            <Delta
              value={scaleForFormat(ind.change.value, ind.change.format)}
              format={ind.change.format}
              goodDirection={ind.change.good_direction}
              suffix={ind.change.label}
            />
          </p>
        )}

        {ind.secondary.length > 0 && (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {ind.secondary.map((s) => (
              <div key={s.label} className="flex gap-1">
                <dt className="text-muted">{s.label}</dt>
                <dd className="num font-medium">{fmtValue(s.value, s.format)}</dd>
              </div>
            ))}
          </dl>
        )}

        {(ind.revision || ind.delayed) && (
          <div className="flex flex-wrap gap-1.5">
            {ind.revision && (
              <span className="chip num" data-testid="revision-badge">
                {revisionText(ind.revision)}
              </span>
            )}
            {ind.delayed && (
              <span className="chip border-neutral bg-surface text-neutral" data-testid="delayed-badge">
                Release delayed
              </span>
            )}
          </div>
        )}

        <div className="mt-auto space-y-0.5 pt-1 text-xs text-muted">
          <p>
            Released {formatDate(ind.released_at)}
            {ind.next_release && <> · Next release: {formatShortDate(ind.next_release)}</>}
          </p>
          <p>
            <a
              href={ind.source_url}
              className="link relative z-10 inline-flex items-center gap-0.5"
              target="_blank"
              rel="noopener noreferrer"
            >
              FRED: {ind.fred_series}
              <ExternalLink className="h-3 w-3" aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </div>
      </div>

      <div id={panelId} hidden={!expanded} className="border-t border-border p-4">
        {expanded && <IndicatorChart indicator={ind} series={series} />}
      </div>
    </article>
  );
}
