/**
 * Tiny inline trend line with no axes. The spec suggests a Recharts line; a plain SVG
 * path keeps the overview's first-load JS small and renders at build time.
 */
export function Sparkline({
  data,
  width = 88,
  height = 28,
  label,
  color = 'var(--chart-1)',
}: {
  data: (number | null)[];
  width?: number;
  height?: number;
  label?: string;
  color?: string;
}) {
  const pts = data.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 2) return null;
  const ys = pts.map((p) => p[1]);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * (width - 2) + 1;
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);
  // Break the line at nulls instead of drawing zero.
  let d = '';
  let pen = false;
  data.forEach((v, i) => {
    if (v == null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  const last = pts[pts.length - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="shrink-0 overflow-visible"
    >
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last[0])} cy={y(last[1])} r={2} fill={color} />
    </svg>
  );
}
