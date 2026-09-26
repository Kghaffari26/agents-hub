'use client';

import type { GrantsLatest, Recommendation } from '@/lib/schemas/grants';
import { formatDate, formatShortDate } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { EmptyState } from '@/components/common/States';
import { SectionHeading } from '@/components/common/Methodology';
import { RecommendationBadge, REC_COLOR_VAR } from './badges';
import { countdownText } from './MatchCard';
import { daysLeft } from './grantsFilters';

type Item = GrantsLatest['deadlines_30d'][number];

const DAY = 86_400_000;
const WINDOW = 30;

/** Shape per recommendation so the chart does not rely on color alone. */
const SHAPE: Record<Recommendation, string> = {
  Pursue: 'rounded-full', // circle
  Consider: 'rotate-45 rounded-[2px]', // diamond
  Pass: 'rounded-[2px]', // square
};
const SHAPE_NAME: Record<Recommendation, string> = { Pursue: 'circle', Consider: 'diamond', Pass: 'square' };

/** Assign each point a lane so markers closer than `minGap` (0–1) don't overlap. */
export function assignLanes(positions: number[], minGap = 0.035): number[] {
  const laneEnds: number[] = [];
  return positions.map((p) => {
    let lane = laneEnds.findIndex((end) => p - end >= minGap);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(p);
    } else laneEnds[lane] = p;
    return lane;
  });
}

export function DeadlineTimeline({ items, topIds }: { items: readonly Item[]; topIds: readonly string[] }) {
  const now = useNow();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + WINDOW * DAY;
  const visible = items
    .map((it) => ({ ...it, t: new Date(it.deadline).getTime() }))
    .filter((it) => Number.isFinite(it.t) && it.t >= now.getTime() && it.t <= end)
    .sort((a, b) => a.t - b.t);
  const pos = visible.map((it) => (it.t - start) / (end - start));
  const lanes = assignLanes(pos);
  const laneCount = Math.max(1, ...lanes.map((l) => l + 1));
  const ticks = [0, 7, 14, 21, 28].map((d) => ({ d, t: start + d * DAY }));
  const top = new Set(topIds);
  const counts = visible.reduce<Record<string, number>>(
    (acc, it) => ((acc[it.recommendation] = (acc[it.recommendation] ?? 0) + 1), acc),
    {},
  );
  const summary = `${visible.length} top-match deadline${visible.length === 1 ? '' : 's'} in the next ${WINDOW} days${
    visible.length
      ? `: ${Object.entries(counts)
          .map(([k, v]) => `${v} ${k}`)
          .join(', ')}; the first closes ${formatDate(new Date(visible[0].t))}`
      : ''
  }.`;

  return (
    <section aria-labelledby="deadline-timeline-title" data-testid="deadline-timeline">
      <SectionHeading id="deadline-timeline-title">Deadlines in the next 30 days</SectionHeading>
      {visible.length === 0 ? (
        <EmptyState title="No top-match deadlines in the next 30 days" />
      ) : (
        <div className="card p-4">
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
            {(['Pursue', 'Consider', 'Pass'] as const).map((r) => (
              <li key={r} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`inline-block h-2.5 w-2.5 ${SHAPE[r]}`}
                  style={{ background: REC_COLOR_VAR[r] }}
                />
                {r} ({SHAPE_NAME[r]})
              </li>
            ))}
          </ul>
          <div className="table-wrap">
            <div className="min-w-[560px] pl-6 pr-10">
              <div
                role="img"
                aria-label={summary}
                className="relative"
                style={{ height: `${laneCount * 22 + 36}px` }}
              >
                {/* axis */}
                <div
                  className="absolute inset-x-0 bg-border"
                  style={{ top: `${laneCount * 22 + 8}px`, height: 1 }}
                  aria-hidden
                />
                {ticks.map(({ d, t }) => (
                  <div
                    key={d}
                    aria-hidden
                    className="absolute text-[11px] leading-none text-muted"
                    style={{ left: `${(d / WINDOW) * 100}%`, top: `${laneCount * 22 + 4}px` }}
                  >
                    <div className="h-2 w-px bg-border" />
                    <div className="num mt-1 -translate-x-1/2 whitespace-nowrap pl-px">
                      {d === 0 ? 'Today' : formatShortDate(new Date(t))}
                    </div>
                  </div>
                ))}
                {visible.map((it, i) => (
                  <div
                    key={it.id}
                    aria-hidden
                    title={`${it.title} — ${formatDate(new Date(it.t))} · ${it.recommendation}, fit ${it.fit}`}
                    className="absolute flex -translate-x-1/2 items-center justify-center"
                    style={{ left: `${pos[i] * 100}%`, top: `${lanes[i] * 22 + 2}px`, width: 18, height: 18 }}
                  >
                    <span
                      className={`block h-3 w-3 ring-2 ring-surface ${SHAPE[it.recommendation]}`}
                      style={{ background: REC_COLOR_VAR[it.recommendation] }}
                    />
                    <span className="num absolute left-4 top-0 text-[11px] font-semibold leading-[18px] text-text">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ol className="mt-4 space-y-1.5 text-sm">
            {visible.map((it, i) => {
              const d = daysLeft(it.deadline, now);
              return (
                <li key={it.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="num w-5 shrink-0 text-right text-xs font-semibold text-muted">
                    {i + 1}.
                  </span>
                  <time
                    dateTime={it.deadline}
                    className={`num w-24 shrink-0 ${d != null && d < 7 ? 'font-semibold text-bad' : ''}`}
                  >
                    {formatShortDate(new Date(it.t))}
                    <span className="sr-only"> ({countdownText(d).toLowerCase()})</span>
                  </time>
                  <span className="min-w-0 flex-1 basis-40">
                    {top.has(it.id) ? (
                      <a href={`#match-${it.id}`} className="link">
                        {it.title}
                      </a>
                    ) : (
                      it.title
                    )}
                  </span>
                  <RecommendationBadge rec={it.recommendation} size="sm" />
                  <span className="num text-xs text-muted">fit {it.fit}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
