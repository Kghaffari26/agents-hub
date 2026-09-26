'use client';

import { useNow } from '@/lib/hooks';
import { daysUntil } from '@/lib/format';
import { meetingRange } from './helpers';

export function countdownText(start: string, end: string, now: Date): string {
  const toStart = daysUntil(start, now);
  const toEnd = daysUntil(end, now);
  if (toStart == null) return '';
  if (toStart > 1) return `in ${toStart} days`;
  if (toStart === 1) return 'tomorrow';
  if (toStart === 0) return 'today';
  if (toEnd != null && toEnd >= 0) return 'in progress';
  return 'concluded';
}

/** "Next meeting Oct 27–28 · in 31 days" with a live countdown. */
export function NextMeeting({
  meeting,
}: {
  meeting: { start: string; end: string; has_sep: boolean } | null;
}) {
  const now = useNow();
  if (!meeting) return <p className="text-sm text-muted">Next meeting: not yet scheduled.</p>;
  return (
    <p className="text-sm">
      <span className="text-muted">Next meeting </span>
      <span className="font-semibold">{meetingRange(meeting.start, meeting.end)}</span>
      <span className="num" suppressHydrationWarning>
        {' · '}
        {countdownText(meeting.start, meeting.end, now)}
      </span>
      {meeting.has_sep && <span className="text-muted"> · with projections</span>}
    </p>
  );
}
