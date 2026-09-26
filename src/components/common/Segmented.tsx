'use client';

import { useRef } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Segmented control as a radiogroup (arrow keys move the selection). Scrolls
 * horizontally inside itself on narrow screens.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  testId,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  testId?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const move = (d: number) => {
    const n = (idx + d + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
      className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-surface-2 p-1 [scrollbar-width:thin]"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-value={o.value}
            onClick={() => onChange(o.value)}
            className={`shrink-0 whitespace-nowrap rounded-md font-medium transition-colors ${
              size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
            } ${on ? 'bg-surface text-text shadow-sm ring-1 ring-border' : 'text-muted hover:text-text'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
