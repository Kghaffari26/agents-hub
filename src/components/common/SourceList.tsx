import { formatDateTime } from '@/lib/format';

export interface SourceItem {
  name: string;
  url: string;
  retrieved_at?: string | null;
  attribution?: string | null;
}

/** Collapsible "Sources" list with links and retrieval times. */
export function SourceList({
  sources,
  defaultOpen = false,
}: {
  sources: SourceItem[];
  defaultOpen?: boolean;
}) {
  if (!sources.length) return null;
  return (
    <details className="group text-sm" open={defaultOpen}>
      <summary className="cursor-pointer select-none list-none text-muted hover:text-text [&::-webkit-details-marker]:hidden">
        <span className="underline decoration-dotted underline-offset-4">Sources ({sources.length})</span>
        <span className="ml-1 inline-block transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <ul className="mt-2 space-y-1.5">
        {sources.map((s) => (
          <li key={s.name + s.url}>
            <a className="link" href={s.url}>
              {s.name}
            </a>
            {s.retrieved_at && (
              <span className="text-muted"> · retrieved {formatDateTime(s.retrieved_at)}</span>
            )}
            {s.attribution && <span className="block text-xs text-muted">{s.attribution}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}
