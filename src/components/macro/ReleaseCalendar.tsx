'use client';

import { useMemo } from 'react';
import { useNow } from '@/lib/hooks';
import { daysUntil } from '@/lib/format';
import type { MacroLatest } from '@/lib/schemas/macro';
import { addDays, isoDay, meetingRange, weekdayDate } from './helpers';

type Entry = { date: string; release: string; names: string[]; fomc?: boolean };

const WINDOW_DAYS = 14;

/** Pick the entries to show: the next 14 days, else the 14 days from the first upcoming date, else everything. */
export function selectEntries(entries: Entry[], today: string): { shown: Entry[]; note: string | null } {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter((e) => e.date >= today);
  const horizon = addDays(today, WINDOW_DAYS);
  const inWindow = upcoming.filter((e) => e.date <= horizon);
  if (inWindow.length) return { shown: inWindow, note: null };
  if (upcoming.length) {
    const from = upcoming[0].date;
    const to = addDays(from, WINDOW_DAYS);
    return {
      shown: upcoming.filter((e) => e.date <= to),
      note: 'Nothing is scheduled in the next 14 days; showing the next scheduled releases.',
    };
  }
  return {
    shown: sorted,
    note: 'These dates have passed; the calendar refreshes on the next agent run.',
  };
}

function relative(date: string, now: Date): string {
  const d = daysUntil(date, now);
  if (d == null) return '';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d > 1) return `in ${d} days`;
  if (d === -1) return 'yesterday';
  return `${-d} days ago`;
}

/** Upcoming releases for tracked indicators plus the next FOMC meeting (SPEC_WEBSITE §7.3 item 7). */
export function ReleaseCalendar({
  calendar,
  nextMeeting,
  names,
}: {
  calendar: MacroLatest['calendar'];
  nextMeeting: MacroLatest['fomc']['next_meeting'];
  names: Record<string, string>;
}) {
  const now = useNow();
  const today = isoDay(now);
  const { shown, note, fomc } = useMemo(() => {
    const entries: Entry[] = calendar.map((c) => ({
      date: c.date,
      release: c.release,
      names: c.indicator_ids.map((id) => names[id] ?? id),
    }));
    const sel = selectEntries(entries, today);
    // The next FOMC meeting is always listed, even beyond the 14-day window.
    const fomc: Entry | null =
      nextMeeting && nextMeeting.end >= today
        ? {
            date: nextMeeting.start,
            release: `FOMC meeting (${meetingRange(nextMeeting.start, nextMeeting.end)})${nextMeeting.has_sep ? ' · with projections' : ''}`,
            names: ['Fed funds target range'],
            fomc: true,
          }
        : null;
    return { ...sel, fomc };
  }, [calendar, names, nextMeeting, today]);

  const all =
    fomc && !shown.some((e) => e.fomc)
      ? [...shown, fomc].sort((a, b) => a.date.localeCompare(b.date))
      : shown;
  const days = all.reduce<{ date: string; items: Entry[] }[]>((acc, e) => {
    const last = acc.at(-1);
    if (last && last.date === e.date) last.items.push(e);
    else acc.push({ date: e.date, items: [e] });
    return acc;
  }, []);

  return (
    <section aria-labelledby="calendar-title" className="card p-4 md:p-5" data-testid="release-calendar">
      <h2 id="calendar-title" className="section-title mb-1">
        Upcoming releases
      </h2>
      <p className="mb-3 text-sm text-muted">
        Scheduled releases for tracked indicators over the next 14 days, plus the next FOMC meeting.
      </p>
      {note && <p className="mb-3 text-sm text-muted">{note}</p>}
      {days.length === 0 ? (
        <p className="text-sm text-muted">No releases are scheduled.</p>
      ) : (
        <ol className="divide-y divide-border">
          {days.map((d) => (
            <li key={d.date} className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-4">
              <p className="shrink-0 text-sm sm:w-40">
                <span className="font-semibold">{weekdayDate(d.date)}</span>{' '}
                <span className="text-xs text-muted" suppressHydrationWarning>
                  {relative(d.date, now)}
                </span>
              </p>
              <ul className="min-w-0 flex-1 space-y-1">
                {d.items.map((e) => (
                  <li key={e.release} className="text-sm">
                    <span className={e.fomc ? 'font-semibold text-accent' : 'font-medium'}>{e.release}</span>
                    {e.names.length > 0 && <span className="text-muted"> — {e.names.join(', ')}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
