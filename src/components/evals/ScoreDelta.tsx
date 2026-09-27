import { arrow, deltaTone, toneClass } from '@/lib/colors';
import { scoreDelta } from '@/lib/format';

/** Change in an eval score (higher is better), with ▲/▼ and tone — never color alone. */
export function ScoreDelta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">first run</span>;
  // Under half a point rounds to "±0 pts": show it flat, with no arrow or tone.
  if (Math.abs(value) < 0.005) value = 0;
  const tone = deltaTone(value, 'up');
  const a = arrow(value);
  return (
    <span className={`num inline-flex items-center gap-0.5 font-medium ${toneClass[tone]}`} data-tone={tone}>
      {a && (
        <span aria-hidden className="text-[0.7em]">
          {a}
        </span>
      )}
      {scoreDelta(value)}
    </span>
  );
}
