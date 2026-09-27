import { Bot, ListChecks } from 'lucide-react';
import type { LooseCitation, ToolStep } from '@/lib/schemas/agentic';
import { count, formatDate, usdPrecise } from '@/lib/format';

/** Shared bits for agent-loop outputs (investigations, bid research, fix proposals, the macro release investigation). */

export interface LoopInfo {
  model?: string | null;
  generated_at?: string | null;
  narrative_source?: 'llm' | 'template' | null;
  steps?: number | null;
  tool_calls?: number | null;
  cost_usd?: number | null;
  confidence?: 'low' | 'medium' | 'high' | null;
}

/** "Agent loop · 5 steps · 4 tool calls · $0.0068 · claude-sonnet-5 · Sep 25, 2026" */
export function LoopMeta({ info, className = '' }: { info: LoopInfo; className?: string }) {
  const template = info.narrative_source === 'template';
  const parts = [
    info.steps != null ? `${count(info.steps)} step${info.steps === 1 ? '' : 's'}` : null,
    info.tool_calls != null ? `${count(info.tool_calls)} tool call${info.tool_calls === 1 ? '' : 's'}` : null,
    info.cost_usd != null ? usdPrecise(info.cost_usd) : null,
    info.model && !template ? info.model : null,
    info.generated_at ? formatDate(info.generated_at) : null,
    info.confidence ? `${info.confidence} confidence` : null,
  ].filter(Boolean);
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted ${className}`}>
      <span
        className="chip"
        title={
          template ? 'The AI text failed the number check; this is a deterministic template.' : undefined
        }
      >
        <Bot className="h-3 w-3 text-accent" aria-hidden />
        {template ? 'Agent loop · template text' : 'Agent loop · AI-generated'}
      </span>
      {parts.length > 0 && <span>{parts.join(' · ')}</span>}
    </p>
  );
}

/** Collapsible "how it got there" list of the tools the loop called. */
export function ToolTrail({ trail, label = 'Tool calls' }: { trail: ToolStep[]; label?: string }) {
  if (!trail.length) return null;
  return (
    <details className="group text-sm">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 text-xs font-medium text-muted hover:text-text">
        <ListChecks className="h-3.5 w-3.5" aria-hidden />
        {label} ({trail.length} call{trail.length === 1 ? '' : 's'})
      </summary>
      <ol className="mt-2 space-y-1 border-l-2 border-border pl-3">
        {trail.map((t, i) => (
          <li key={i} className="text-xs">
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px] text-text">{t.tool}</code>
            {t.is_error && <strong className="ml-1 text-bad">error</strong>}
            {t.summary && <span className="ml-1.5 text-muted">{t.summary}</span>}
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Numbered source list. */
export function CitationList({
  citations,
  title = 'Sources',
  testId,
}: {
  citations: LooseCitation[];
  title?: string;
  testId?: string;
}) {
  if (!citations.length) return null;
  return (
    <div data-testid={testId}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs">
        {citations.map((c) => (
          <li key={c.url + c.name}>
            <a className="link break-words" href={c.url}>
              {c.name}
            </a>
            {c.note && <span className="text-muted"> — {c.note}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Plain agent text with `backtick` spans shown as code (no other Markdown, no HTML). */
export function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.length > 2 && p.startsWith('`') && p.endsWith('`') ? (
          <code
            key={i}
            className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em] [overflow-wrap:anywhere]"
          >
            {p.slice(1, -1)}
          </code>
        ) : (
          p
        ),
      )}
    </>
  );
}
