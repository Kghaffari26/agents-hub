import type { TopMatch } from '@/lib/schemas/grants';
import { SectionHeading } from '@/components/common/Methodology';
import { EmptyState } from '@/components/common/States';
import { MatchCard } from './MatchCard';

/** Top 10 matches by fit, ties broken by the nearest deadline. */
export function topByFit(matches: readonly TopMatch[], n = 10): TopMatch[] {
  const t = (m: TopMatch) => (m.deadline ? new Date(m.deadline).getTime() : Number.POSITIVE_INFINITY);
  return [...matches].sort((a, b) => b.fit - a.fit || t(a) - t(b)).slice(0, n);
}

export function TopMatches({ matches, total }: { matches: readonly TopMatch[]; total: number }) {
  const top = topByFit(matches);
  return (
    <section aria-labelledby="top-matches">
      <SectionHeading id="top-matches">
        Top matches{' '}
        <span className="text-sm font-normal text-muted">
          ({top.length} of {total} by fit score)
        </span>
      </SectionHeading>
      {top.length === 0 ? (
        <EmptyState title="No matches this run">
          Nothing passed the filters and scoring for the current profile.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {top.map((m, i) => (
            <MatchCard key={m.id} match={m} rank={i + 1} />
          ))}
        </div>
      )}
    </section>
  );
}
