'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? '2026-01-01T00:00:00Z';

/**
 * "Now" for relative times: the build time during SSR and hydration (so markup matches),
 * then the real clock, refreshed every minute.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date(BUILD_TIME));
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function subscribeTheme(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => obs.disconnect();
}

/** true when <html> has the `dark` class; re-renders on theme change. */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  );
}

const TOKENS = [
  'text',
  'text-muted',
  'border',
  'surface',
  'surface-2',
  'accent',
  'good',
  'bad',
  'neutral',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'diverge-neg',
  'diverge-mid',
  'diverge-pos',
] as const;
export type Token = (typeof TOKENS)[number];

const LIGHT: Record<Token, string> = {
  text: '#16181d',
  'text-muted': '#5b6270',
  border: '#e4e4e0',
  surface: '#ffffff',
  'surface-2': '#f3f3f1',
  accent: '#2f5bea',
  good: '#1a7f4b',
  bad: '#c23a2b',
  neutral: '#7a5f14',
  'chart-1': '#2f5bea',
  'chart-2': '#e0781f',
  'chart-3': '#1a9e8a',
  'chart-4': '#9b4dca',
  'diverge-neg': '#c23a2b',
  'diverge-mid': '#e9e6df',
  'diverge-pos': '#1a7f4b',
};

/** Chart colors read from CSS variables; re-read whenever the theme changes. */
export function useThemeColors(): Record<Token, string> {
  const dark = useIsDark();
  const [colors, setColors] = useState(LIGHT);
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const next = { ...LIGHT };
    for (const t of TOKENS) next[t] = cs.getPropertyValue(`--${t}`).trim() || LIGHT[t];
    setColors(next);
  }, [dark]);
  return colors;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia('(prefers-reduced-motion: reduce)');
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  );
}

export function useMediaQuery(q: string, ssr = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(q);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(q).matches,
    () => ssr,
  );
}
