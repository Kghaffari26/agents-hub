import { FlaskConical } from 'lucide-react';

/** Shown when an agent hasn't published to its data branch yet and fixtures are displayed. */
export function SampleBadge({ repo }: { repo?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral/60 bg-surface-2 px-2 py-0.5 text-xs font-semibold text-neutral"
      title={
        repo
          ? `${repo} hasn't published to its data branch yet; showing committed sample data.`
          : 'Sample data'
      }
      data-testid="sample-badge"
    >
      <FlaskConical className="h-3 w-3" aria-hidden /> Sample data
    </span>
  );
}
