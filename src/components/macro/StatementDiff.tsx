'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { diffWords, type Change } from 'diff';
import type { FomcChange } from '@/lib/schemas/macro';
import { useMediaQuery } from '@/lib/hooks';
import { formatDate } from '@/lib/format';
import { Segmented } from './ChartParts';

/** Additions/deletions are tinted AND marked with <ins>/<del> + underline/strikethrough (never color alone). */
const INS =
  'rounded-sm bg-[color-mix(in_srgb,var(--good)_18%,transparent)] px-0.5 underline decoration-good decoration-2 underline-offset-2';
const DEL =
  'rounded-sm bg-[color-mix(in_srgb,var(--bad)_14%,transparent)] px-0.5 line-through decoration-bad decoration-2';

export function splitParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

type Block =
  | { kind: 'same'; index: number; text: string }
  | { kind: 'changed'; index: number; before: string | null; after: string | null; parts: Change[] };

/** Pair paragraphs by index and word-diff the pairs that differ. */
export function diffParagraphs(previous: string, latest: string): Block[] {
  const a = splitParagraphs(previous);
  const b = splitParagraphs(latest);
  const n = Math.max(a.length, b.length);
  const out: Block[] = [];
  for (let i = 0; i < n; i++) {
    const before = a[i] ?? null;
    const after = b[i] ?? null;
    if (before != null && before === after) out.push({ kind: 'same', index: i, text: before });
    else out.push({ kind: 'changed', index: i, before, after, parts: diffWords(before ?? '', after ?? '') });
  }
  return out;
}

type Row =
  | { kind: 'group'; start: number; blocks: Extract<Block, { kind: 'same' }>[] }
  | Extract<Block, { kind: 'changed' }>;

function groupUnchanged(blocks: Block[]): Row[] {
  const rows: Row[] = [];
  for (const b of blocks) {
    if (b.kind === 'changed') rows.push(b);
    else {
      const last = rows.at(-1);
      if (last && last.kind === 'group') last.blocks.push(b);
      else rows.push({ kind: 'group', start: b.index, blocks: [b] });
    }
  }
  return rows;
}

function Parts({ parts, show }: { parts: Change[]; show: 'both' | 'before' | 'after' }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.added) {
          return show === 'before' ? null : (
            <ins key={i} className={INS}>
              {p.value}
            </ins>
          );
        }
        if (p.removed) {
          return show === 'after' ? null : (
            <del key={i} className={DEL}>
              {p.value}
            </del>
          );
        }
        return <Fragment key={i}>{p.value}</Fragment>;
      })}
    </>
  );
}

const TYPE_LABEL = { added: 'Added', removed: 'Removed', modified: 'Modified' } as const;

function KeyEdits({ changes, cited }: { changes: FomcChange[]; cited: number[] }) {
  if (!changes.length) return <p className="text-sm text-muted">No sentence-level changes.</p>;
  return (
    <ul className="space-y-2 text-sm leading-relaxed" data-testid="key-edits">
      {changes.map((ch, i) => {
        let body: ReactNode;
        if (ch.type === 'modified')
          body = <Parts parts={diffWords(ch.before ?? '', ch.after ?? '')} show="both" />;
        else if (ch.type === 'added') body = <ins className={INS}>{ch.after}</ins>;
        else body = <del className={DEL}>{ch.before}</del>;
        return (
          <li key={`${ch.idx}-${i}`} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
            <span className="flex shrink-0 flex-wrap gap-1">
              <span className="chip">{TYPE_LABEL[ch.type]}</span>
              {cited.includes(i) && <span className="chip border-accent text-accent">Cited in the read</span>}
            </span>
            <span className="min-w-0">{body}</span>
          </li>
        );
      })}
    </ul>
  );
}

export interface StatementDiffProps {
  previousText: string | null;
  latestText: string;
  previousDate?: string | null;
  latestDate?: string | null;
  changes: FomcChange[];
  citedChangeIdx?: number[];
}

/** Word-level FOMC statement diff (jsdiff), inline or side by side; unchanged paragraphs collapsed. */
export function StatementDiff({
  previousText,
  latestText,
  previousDate,
  latestDate,
  changes,
  citedChangeIdx = [],
}: StatementDiffProps) {
  const wide = useMediaQuery('(min-width: 768px)');
  const [mode, setMode] = useState<'inline' | 'side'>('inline');
  const [openGroups, setOpenGroups] = useState<Set<number>>(() => new Set());
  const effective = wide ? mode : 'inline';

  const rows = useMemo(
    () => (previousText == null ? [] : groupUnchanged(diffParagraphs(previousText, latestText))),
    [previousText, latestText],
  );

  const prevLabel = previousDate ? `Previous (${formatDate(previousDate)})` : 'Previous';
  const latestLabel = latestDate ? `Latest (${formatDate(latestDate)})` : 'Latest';

  if (previousText == null) {
    return (
      <div data-testid="statement-diff" className="space-y-2">
        <h3 className="text-base font-semibold">Statement changes</h3>
        <p className="text-sm text-muted">No previous statement to compare.</p>
      </div>
    );
  }

  const toggleGroup = (start: number) =>
    setOpenGroups((s) => {
      const next = new Set(s);
      if (next.has(start)) next.delete(start);
      else next.add(start);
      return next;
    });

  return (
    <div data-testid="statement-diff" className="space-y-4">
      <div>
        <h3 className="mb-2 text-base font-semibold">Key edits</h3>
        <KeyEdits changes={changes} cited={citedChangeIdx} />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Statement diff</h3>
          {wide && (
            <Segmented
              label="Diff layout"
              value={mode}
              onChange={setMode}
              options={[
                { id: 'inline', label: 'Inline' },
                { id: 'side', label: 'Side by side' },
              ]}
            />
          )}
        </div>
        <p className="mb-3 text-xs text-muted">
          <ins className={INS}>Added text</ins> is underlined; <del className={DEL}>removed text</del> is
          struck through. Comparing {prevLabel.toLowerCase()} with {latestLabel.toLowerCase()}.
        </p>

        {effective === 'side' && (
          <div
            className="mb-2 grid grid-cols-2 gap-4 text-xs font-semibold uppercase tracking-wide text-muted"
            aria-hidden
          >
            <span>{prevLabel}</span>
            <span>{latestLabel}</span>
          </div>
        )}

        <div className="space-y-3 text-sm leading-relaxed" data-mode={effective}>
          {rows.map((row) => {
            if (row.kind === 'group') {
              const n = row.blocks.length;
              const open = openGroups.has(row.start);
              return (
                <div key={`g-${row.start}`} className="space-y-3">
                  <button
                    type="button"
                    className="btn w-full justify-center text-xs text-muted"
                    aria-expanded={open}
                    onClick={() => toggleGroup(row.start)}
                  >
                    {open ? 'Hide' : 'Show'} {n} unchanged {n === 1 ? 'paragraph' : 'paragraphs'}
                  </button>
                  {open &&
                    row.blocks.map((b) =>
                      effective === 'side' ? (
                        <div key={b.index} className="grid grid-cols-2 gap-4 text-muted">
                          <p>{b.text}</p>
                          <p>{b.text}</p>
                        </div>
                      ) : (
                        <p key={b.index} className="text-muted">
                          {b.text}
                        </p>
                      ),
                    )}
                </div>
              );
            }
            return effective === 'side' ? (
              <div key={`c-${row.index}`} className="grid grid-cols-2 gap-4">
                <div>
                  <span className="sr-only">{prevLabel}: </span>
                  {row.before == null ? (
                    <p className="italic text-muted">(no paragraph)</p>
                  ) : (
                    <p>
                      <Parts parts={row.parts} show="before" />
                    </p>
                  )}
                </div>
                <div>
                  <span className="sr-only">{latestLabel}: </span>
                  {row.after == null ? (
                    <p className="italic text-muted">(no paragraph)</p>
                  ) : (
                    <p>
                      <Parts parts={row.parts} show="after" />
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p key={`c-${row.index}`}>
                <Parts parts={row.parts} show="both" />
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
