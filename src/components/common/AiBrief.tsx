import { Sparkles } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

export interface AiBriefProps {
  text?: string;
  bullets?: { text: string; citations?: { name: string; url: string }[] }[];
  keyPoints?: string[];
  citations?: { name: string; url: string }[];
  model?: string | null;
  generatedAt?: string | null;
  narrativeSource?: 'llm' | 'template';
  reused?: boolean;
  title?: string;
}

/** Styled AI narrative with an "AI-generated" label, footnoted citations and the model name. */
export function AiBrief({
  text,
  bullets,
  keyPoints,
  citations = [],
  model,
  generatedAt,
  narrativeSource = 'llm',
  reused,
  title = 'AI brief',
}: AiBriefProps) {
  // Collect footnotes: brief-level citations plus per-bullet ones, de-duplicated by URL.
  const notes: { name: string; url: string }[] = [];
  const idx = (c: { name: string; url: string }) => {
    let i = notes.findIndex((n) => n.url === c.url);
    if (i === -1) {
      notes.push(c);
      i = notes.length - 1;
    }
    return i + 1;
  };
  citations.forEach(idx);
  const isTemplate = narrativeSource === 'template';
  return (
    <section className="card relative overflow-hidden p-4 md:p-5" aria-label={title}>
      <div className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <span
          className="chip"
          title={
            isTemplate ? 'Deterministic template text (the AI output failed the number check)' : undefined
          }
        >
          <Sparkles className="h-3 w-3 text-accent" aria-hidden />
          {isTemplate ? 'Template summary' : 'AI-generated'}
        </span>
        {reused && <span className="chip">No new data · reused</span>}
      </div>
      {text && <p className="leading-relaxed">{text}</p>}
      {bullets && bullets.length > 0 && (
        <ul className="list-disc space-y-2 pl-5 leading-relaxed">
          {bullets.map((b, i) => (
            <li key={i}>
              {b.text}
              {b.citations?.map((c) => {
                const n = idx(c);
                return (
                  <sup key={c.url} className="ml-0.5">
                    <a href={c.url} className="link" aria-label={`Source ${n}: ${c.name}`}>
                      [{n}]
                    </a>
                  </sup>
                );
              })}
            </li>
          ))}
        </ul>
      )}
      {keyPoints && keyPoints.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {keyPoints.map((k) => (
            <li key={k} className="chip num">
              {k}
            </li>
          ))}
        </ul>
      )}
      {notes.length > 0 && (
        <ol className="mt-3 space-y-0.5 border-t border-border pt-2 text-xs text-muted">
          {notes.map((n, i) => (
            <li key={n.url}>
              [{i + 1}]{' '}
              <a href={n.url} className="link">
                {n.name}
              </a>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-xs text-muted">
        {model ? <>Model: {model}</> : isTemplate ? 'Deterministic template' : null}
        {generatedAt && <> · {formatDateTime(generatedAt)}</>}
      </p>
    </section>
  );
}
