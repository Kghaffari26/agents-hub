import type { SubScores } from '@/lib/schemas/grants';

export const SUB_SCORE_MAX: { key: keyof SubScores; label: string; max: number }[] = [
  { key: 'capability', label: 'Capability', max: 40 },
  { key: 'eligibility', label: 'Eligibility', max: 20 },
  { key: 'size', label: 'Size', max: 15 },
  { key: 'timeline', label: 'Timeline', max: 15 },
  { key: 'strategic', label: 'Strategic', max: 10 },
];

function barColor(pct: number): string {
  if (pct >= 0.75) return 'bg-good';
  if (pct >= 0.55) return 'bg-neutral';
  return 'bg-bad';
}

function Bar({ value, max, label, big }: { value: number; max: number; label: string; big?: boolean }) {
  const clamped = Math.max(0, Math.min(max, value));
  const pct = max > 0 ? clamped / max : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={`${clamped} of ${max}`}
      className={`relative w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-border ${big ? 'h-2.5' : 'h-1.5'}`}
    >
      <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

/** Fit score 0–100 with the five rubric sub-score bars. */
export function FitMeter({
  fit,
  subScores,
  compact = false,
}: {
  fit: number;
  subScores?: SubScores;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Fit score</span>
        <span className="num text-sm">
          <span className="text-lg font-semibold">{Math.round(fit)}</span>
          <span className="text-muted">/100</span>
        </span>
      </div>
      <Bar value={fit} max={100} label="Fit score" big />
      {!compact && subScores && (
        <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 pt-1 sm:grid-cols-2" aria-label="Sub-scores">
          {SUB_SCORE_MAX.map(({ key, label, max }) => (
            <li key={key} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted">{label}</span>
                <span className="num">
                  {subScores[key]}
                  <span className="text-muted">/{max}</span>
                </span>
              </div>
              <Bar value={subScores[key]} max={max} label={`${label} sub-score`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
