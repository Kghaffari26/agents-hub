'use client';

import { useNow } from '@/lib/hooks';
import { DASH, formatDateTime, relativeTime } from '@/lib/format';

/** Relative time ("3 days ago") with the absolute time on hover; ticks with useNow. */
export function RelTime({ at }: { at: string | null | undefined }) {
  const now = useNow();
  if (!at) return <>{DASH}</>;
  return (
    <time dateTime={at} title={formatDateTime(at)} className="num">
      {relativeTime(at, now)}
    </time>
  );
}
