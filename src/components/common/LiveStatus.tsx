'use client';

import { useNow } from '@/lib/hooks';
import { effectiveStatus } from '@/lib/stale';
import type { RunStatus } from '@/lib/schemas/common';
import { AgentStatusBadge } from './AgentStatusBadge';
import { relativeTime } from '@/lib/format';

/** Status badge that re-checks staleness in the browser (manifest may say ok while stale). */
export function LiveStatusBadge({
  status,
  lastRunAt,
  intervalHours,
}: {
  status: RunStatus;
  lastRunAt: string;
  intervalHours: number;
}) {
  const now = useNow();
  return <AgentStatusBadge status={effectiveStatus(status, lastRunAt, intervalHours, now)} />;
}

export function LastActivity({ at }: { at: string }) {
  const now = useNow();
  return (
    <time dateTime={at} className="num font-semibold text-text">
      {relativeTime(at, now)}
    </time>
  );
}
