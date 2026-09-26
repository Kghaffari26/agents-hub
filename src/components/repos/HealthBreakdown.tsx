'use client';

import { useId, useState } from 'react';
import type { Repo } from '@/lib/schemas/repoMaint';

/**
 * Health score + letter grade. The penalty breakdown opens on hover, on keyboard focus
 * and on click/tap (click pins it open; Escape closes it).
 */
export function HealthBreakdown({ health, repoName }: { health: Repo['health']; repoName: string }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = pinned || hover || focused;
  const panelId = useId();

  const closeAll = () => {
    setPinned(false);
    setHover(false);
    setFocused(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          closeAll();
        }
      }}
    >
      <button
        type="button"
        className="flex items-baseline gap-2 rounded-md text-left"
        aria-expanded={open}
        aria-controls={panelId}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
        }}
        onClick={() => {
          if (pinned) closeAll();
          else setPinned(true);
        }}
      >
        <span className="num text-3xl font-bold leading-none" aria-hidden>
          {health.grade}
        </span>
        <span className="num text-lg font-semibold leading-none" aria-hidden>
          {Math.round(health.score)}
          <span className="text-sm font-normal text-muted">/100</span>
        </span>
        <span className="sr-only">
          Health grade {health.grade}, score {Math.round(health.score)} out of 100. Show penalty breakdown for{' '}
          {repoName}
        </span>
        <span
          className="ml-1 self-center text-xs text-muted underline decoration-dotted underline-offset-4"
          aria-hidden
        >
          Why?
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-label={`Health breakdown for ${repoName}`}
        hidden={!open}
        data-testid="health-breakdown"
        className="absolute left-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-card border border-border bg-surface p-3 text-sm shadow-lg"
      >
        <p className="mb-2 font-semibold">Starts at 100</p>
        {health.breakdown.length === 0 ? (
          <p className="text-muted">No penalties this run.</p>
        ) : (
          <ul className="space-y-1">
            {health.breakdown.map((b) => (
              <li key={b.reason} className="flex justify-between gap-3">
                <span>{b.reason}</span>
                <span className="num shrink-0 font-medium text-bad">
                  {b.points > 0 ? '+' : b.points < 0 ? '−' : ''}
                  {Math.abs(b.points)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
          <span>Score</span>
          <span className="num">
            {Math.round(health.score)} · {health.grade}
          </span>
        </p>
      </div>
    </div>
  );
}
