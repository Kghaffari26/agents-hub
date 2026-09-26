'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { MAX_COMPARE, US } from '@/lib/urlState';
import { US_LABEL } from './helpers';

export interface PickerOption {
  slug: string;
  name: string;
}

/**
 * Metro combobox (WAI-ARIA 1.2 combobox + listbox pattern) with removable chips.
 * Up to MAX_COMPARE selections; "United States" is a pseudo-metro.
 */
export function MetroPicker({
  options,
  selected,
  onChange,
  max = MAX_COMPARE,
  colors = [],
}: {
  options: PickerOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
  colors?: string[];
}) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const all = useMemo(() => [{ slug: US, name: US_LABEL }, ...options], [options]);
  const nameOf = (slug: string) => all.find((o) => o.slug === slug)?.name ?? slug;
  const full = selected.length >= max;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const avail = all.filter((o) => !selected.includes(o.slug));
    if (!q) return avail;
    const starts = avail.filter((o) => o.name.toLowerCase().startsWith(q));
    const contains = avail.filter((o) => !starts.includes(o) && o.name.toLowerCase().includes(q));
    return [...starts, ...contains];
  }, [all, query, selected]);

  const choose = (slug: string) => {
    if (full || selected.includes(slug)) return;
    onChange([...selected, slug]);
    setQuery('');
    setActive(0);
    if (selected.length + 1 >= max) setOpen(false);
  };
  const remove = (slug: string) => {
    onChange(selected.filter((s) => s !== slug));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && matches[active]) {
        e.preventDefault();
        choose(matches[active].slug);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else setQuery('');
    } else if (e.key === 'Backspace' && !query && selected.length) {
      remove(selected[selected.length - 1]);
    }
  };

  const activeId = open && matches[active] ? `${id}-opt-${matches[active].slug}` : undefined;

  return (
    <div className="space-y-2" data-testid="metro-picker">
      <label htmlFor={`${id}-input`} className="text-sm font-medium">
        Compare metros <span className="font-normal text-muted">(up to {max})</span>
      </label>
      <ul className="flex flex-wrap gap-2" aria-label="Selected metros">
        {selected.map((slug, i) => (
          <li key={slug}>
            <span className="chip py-1 pl-2 pr-1 text-sm" data-testid="metro-chip" data-slug={slug}>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: colors[i] ?? 'var(--chart-1)' }}
                aria-hidden
              />
              {nameOf(slug)}
              <button
                type="button"
                onClick={() => remove(slug)}
                className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-border"
                aria-label={`Remove ${nameOf(slug)}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={open && !full}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={full ? `${id}-full` : undefined}
          autoComplete="off"
          disabled={full}
          placeholder={full ? `${max} selected — remove one to add another` : 'Type a metro, e.g. Austin'}
          className="input w-full pl-8 disabled:cursor-not-allowed disabled:opacity-70"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {full && (
          <p id={`${id}-full`} className="sr-only">
            Maximum of {max} metros selected. Remove one to add another.
          </p>
        )}
        {open && !full && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Metros"
            className="card absolute z-30 mt-1 max-h-72 w-full overflow-auto p-1 shadow-lg"
          >
            {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matching metros</li>}
            {matches.map((o, i) => (
              <li
                key={o.slug}
                id={`${id}-opt-${o.slug}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o.slug)}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer rounded px-3 py-1.5 text-sm ${i === active ? 'bg-surface-2 text-text' : ''}`}
              >
                {o.name}
                {o.slug === US && <span className="ml-1 text-xs text-muted">national</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
