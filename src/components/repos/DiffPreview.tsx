import { parseDiff, type DiffLineKind } from './diff';

const CLS: Record<DiffLineKind, string> = {
  file: 'bg-surface-2 font-semibold text-text',
  meta: 'text-muted',
  hunk: 'bg-accent/10 text-muted',
  add: 'bg-good/15 text-text',
  del: 'bg-bad/15 text-text',
  ctx: 'text-text',
};

const PREVIEW_LINES = 28;
/** Don't hide a tail shorter than this behind a disclosure. */
const MIN_HIDDEN = 12;

/**
 * Unified diff with +/− kept in the text (color is a second cue, never the only one). Long diffs
 * show a preview and a native disclosure for the rest.
 */
export function DiffPreview({ diff, label }: { diff: string; label: string }) {
  const lines = parseDiff(diff);
  const cut = lines.length - PREVIEW_LINES < MIN_HIDDEN ? lines.length : PREVIEW_LINES;
  const render = (from: number, to: number) =>
    lines.slice(from, to).map((l, i) => (
      <span key={from + i} className={`block min-w-max px-3 ${CLS[l.kind]}`} data-kind={l.kind}>
        {l.text || ' '}
        {'\n'}
      </span>
    ));
  return (
    <div className="overflow-hidden rounded-md border border-border" data-testid="diff-preview">
      <pre
        className="max-h-[420px] overflow-auto bg-surface py-1 font-mono text-[12px] leading-5"
        tabIndex={0}
        aria-label={label}
      >
        <code>{render(0, cut)}</code>
      </pre>
      {lines.length > cut && (
        <details className="border-t border-border">
          <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-muted hover:text-text">
            Show the remaining {lines.length - cut} lines
          </summary>
          <pre
            className="max-h-[520px] overflow-auto bg-surface py-1 font-mono text-[12px] leading-5"
            tabIndex={0}
            aria-label={`${label}, continued`}
          >
            <code>{render(cut, lines.length)}</code>
          </pre>
        </details>
      )}
    </div>
  );
}
