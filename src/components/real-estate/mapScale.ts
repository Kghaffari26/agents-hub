import type { MetroSummary } from '@/lib/schemas/realEstate';
import { divergingColor, percentileBounds, sequentialColor } from '@/lib/colors';
import { yoyOf, type ResolvedMetric } from '@/lib/metrics';

export interface MapPoint {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  value: number | null;
  level: number | null;
  size: number;
  radius: number;
}

export interface MapScale {
  mode: 'yoy' | 'level';
  lo: number;
  hi: number;
  color: (v: number | null) => string;
}

/** Points + color scale for the selected metric: YoY diverging (clamped p5–p95), or level sequential. */
export function buildMapData(
  metros: MetroSummary[],
  metric: ResolvedMetric,
  palette: { neg: string; mid: string; pos: string; seqFrom: string; seqTo: string },
): { points: MapPoint[]; scale: MapScale } {
  const withCoords = metros.filter((m) => m.lat != null && m.lon != null);
  const yoys = withCoords.map((m) => yoyOf(m.latest[metric.key]));
  const mode: MapScale['mode'] = yoys.some((v) => v != null) ? 'yoy' : 'level';
  const values = mode === 'yoy' ? yoys : withCoords.map((m) => m.latest[metric.key]?.value ?? null);
  const [lo, hi] = percentileBounds(values, 0.05);
  const sizes = withCoords.map((m) => m.homes_sold_12m ?? 0);
  const maxSize = Math.max(...sizes, 1);
  const invert = metric.goodDirection === 'down';
  const color =
    mode === 'yoy'
      ? (v: number | null) =>
          divergingColor(v == null ? null : invert ? -v : v, lo, hi, {
            neg: palette.neg,
            mid: palette.mid,
            pos: palette.pos,
          })
      : (v: number | null) => sequentialColor(v, lo, hi, palette.seqFrom, palette.seqTo);
  const points = withCoords.map((m, i) => ({
    slug: m.slug,
    name: m.name,
    lat: m.lat as number,
    lon: m.lon as number,
    value: mode === 'yoy' ? yoys[i] : (m.latest[metric.key]?.value ?? null),
    level: m.latest[metric.key]?.value ?? null,
    size: sizes[i],
    // sqrt scale on market size (SPEC_WEBSITE §7.2)
    radius: 5 + 17 * Math.sqrt(sizes[i] / maxSize),
  }));
  return { points, scale: { mode, lo, hi, color } };
}
