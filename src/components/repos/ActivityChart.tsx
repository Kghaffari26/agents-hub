import type { Repo } from '@/lib/schemas/repoMaint';

const W = 240;
const H = 44;

/**
 * 12-week issues opened vs closed: two series on one shared scale (so they're comparable),
 * opened solid, closed dashed, with a text legend.
 */
export function ActivityChart({ activity, repoName }: { activity: Repo['activity_12w']; repoName: string }) {
  const { opened, closed, weeks } = activity;
  const n = Math.max(opened.length, closed.length);
  const sumO = opened.reduce((s, v) => s + v, 0);
  const sumC = closed.reduce((s, v) => s + v, 0);
  const label = `${repoName}, ${weeks.length || n} weeks: ${sumO} issues opened, ${sumC} closed`;
  if (n < 2) {
    return <p className="text-xs text-muted">Not enough activity data yet.</p>;
  }
  const max = Math.max(1, ...opened, ...closed);
  const x = (i: number) => (i / (n - 1)) * (W - 4) + 2;
  const y = (v: number) => H - 2 - (v / max) * (H - 4);
  const path = (arr: number[]) =>
    arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');

  return (
    <figure className="space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        className="block h-11 w-full overflow-visible"
      >
        <line x1={0} x2={W} y1={H - 2} y2={H - 2} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        <path
          d={path(opened)}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth={1.75}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path(closed)}
          fill="none"
          stroke="var(--chart-2)"
          strokeWidth={1.75}
          strokeDasharray="4 3"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted" aria-hidden>
        <span className="inline-flex items-center gap-1">
          <svg width="16" height="6" aria-hidden>
            <line x1="0" x2="16" y1="3" y2="3" stroke="var(--chart-1)" strokeWidth="2" />
          </svg>
          Opened <span className="num text-text">{sumO}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width="16" height="6" aria-hidden>
            <line
              x1="0"
              x2="16"
              y1="3"
              y2="3"
              stroke="var(--chart-2)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>
          Closed <span className="num text-text">{sumC}</span>
        </span>
        <span>last 12 weeks</span>
      </figcaption>
    </figure>
  );
}
