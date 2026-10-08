'use client';

import { useNow } from '@/lib/hooks';
import { formatDateTime, formatShortDate, relativeTime } from '@/lib/format';
import { isStale } from '@/lib/stale';
import { AgentStatusBadge } from './AgentStatusBadge';

export interface LastUpdatedProps {
  /** When the agent last ran. */
  at: string;
  /** When the source data last changed (null = unknown). */
  dataChangedAt?: string | null;
  intervalHours: number;
  /** The run found no new source data (meta.data_changed = false). */
  noNewData?: boolean;
  /** Short form for cards that already show a status badge: no "no new data since", no stale badge. */
  compact?: boolean;
}

/** Relative time + absolute on hover, stale badge, "no new data since…" (SPEC_WEBSITE §5). */
export function LastUpdated({ at, dataChangedAt, intervalHours, noNewData, compact }: LastUpdatedProps) {
  const now = useNow();
  const stale = isStale(at, intervalHours, now);
  const unchanged =
    noNewData || (dataChangedAt && new Date(dataChangedAt).getTime() < new Date(at).getTime() - 60_000);
  return (
    <span
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted"
      data-testid="last-updated"
    >
      <span>
        {unchanged ? 'Checked' : 'Updated'}{' '}
        <time dateTime={at} title={formatDateTime(at)} className="num font-medium text-text">
          {relativeTime(at, now)}
        </time>
        {unchanged && dataChangedAt && !compact && <> · no new data since {formatShortDate(dataChangedAt)}</>}
      </span>
      {/* Compact use sits next to the card's own status badge; don't show "Stale" twice. */}
      {stale && !compact && <AgentStatusBadge status="stale" />}
    </span>
  );
}
