import type { GoodDirection } from './schemas/common';

/** Semantic delta coloring (SPEC_WEBSITE §5): direction-aware, never sign-only. */
export type Tone = 'good' | 'bad' | 'neutral' | 'flat';

export function deltaTone(
  delta: number | null | undefined,
  goodDirection: GoodDirection | null | undefined,
): Tone {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return 'flat';
  const dir = goodDirection ?? 'neutral';
  if (dir === 'neutral') return 'neutral';
  const up = delta > 0;
  return (dir === 'up') === up ? 'good' : 'bad';
}

export const toneClass: Record<Tone, string> = {
  good: 'text-good',
  bad: 'text-bad',
  neutral: 'text-neutral',
  flat: 'text-muted',
};

export function arrow(delta: number | null | undefined): '▲' | '▼' | '' {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return '';
  return delta > 0 ? '▲' : '▼';
}

/** Read a CSS custom property (charts re-read on theme change). */
export function cssVar(name: string, fallback = '#888'): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return v || fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`;
}

/**
 * Diverging scale: value in [lo, hi] (clamped) → neg ↔ mid ↔ pos. `invert` flips it
 * for metrics where "up" is bad; for neutral metrics the caller picks an orientation.
 */
export function divergingColor(
  v: number | null | undefined,
  lo: number,
  hi: number,
  palette: { neg: string; mid: string; pos: string },
): string {
  if (v == null || !Number.isFinite(v)) return palette.mid;
  const bound = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
  const t = Math.max(-1, Math.min(1, v / bound));
  return t < 0 ? mix(palette.mid, palette.neg, -t) : mix(palette.mid, palette.pos, t);
}

/** Sequential scale for level-only metrics. */
export function sequentialColor(
  v: number | null | undefined,
  lo: number,
  hi: number,
  from: string,
  to: string,
): string {
  if (v == null || !Number.isFinite(v) || hi === lo) return from;
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return mix(from, to, t);
}

/** 5th/95th percentile bounds for clamping (SPEC_WEBSITE §7.2 map). */
export function percentileBounds(values: (number | null | undefined)[], p = 0.05): [number, number] {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return [0, 0];
  const at = (q: number) => v[Math.min(v.length - 1, Math.max(0, Math.round(q * (v.length - 1))))];
  return [at(p), at(1 - p)];
}
