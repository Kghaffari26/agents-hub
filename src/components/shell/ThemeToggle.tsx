'use client';

import { useEffect, useRef, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { applyTheme, readThemeChoice, type ThemeChoice } from '@/lib/theme';

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

/** system / light / dark (SPEC_WEBSITE §5–6). */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>('system');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setChoice(readThemeChoice()), []);
  useEffect(() => {
    if (choice !== 'system') return;
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('system');
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [choice]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const current = OPTIONS.find((o) => o.value === choice) ?? OPTIONS[0];
  const select = (v: ThemeChoice) => {
    setChoice(v);
    applyTheme(v);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}. Change theme`}
        data-testid="theme-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        <current.Icon className="h-5 w-5" aria-hidden />
      </button>
      {open && (
        <div role="group" aria-label="Theme" className="card absolute right-0 top-11 z-50 w-36 p-1 shadow-lg">
          {OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={choice === value}
              data-theme-option={value}
              onClick={() => select(value)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${
                choice === value ? 'font-semibold text-accent' : ''
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
