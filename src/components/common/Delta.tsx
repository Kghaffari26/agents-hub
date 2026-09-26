import type { GoodDirection, StatFormat } from '@/lib/schemas/common';
import { arrow, deltaTone, toneClass } from '@/lib/colors';
import { formatDelta, type FormatOptions } from '@/lib/format';

/** A signed change with ▲/▼ and semantic color (never color alone). */
export function Delta({
  value,
  format,
  goodDirection,
  opts,
  suffix,
  className = '',
}: {
  value: number | null | undefined;
  format: StatFormat | null | undefined;
  goodDirection?: GoodDirection | null;
  opts?: FormatOptions;
  suffix?: string;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) return <span className={`text-muted ${className}`}>—</span>;
  const tone = deltaTone(value, goodDirection);
  const a = arrow(value);
  return (
    <span
      className={`num inline-flex items-center gap-0.5 font-medium ${toneClass[tone]} ${className}`}
      data-tone={tone}
    >
      {a && (
        <span aria-hidden className="text-[0.7em]">
          {a}
        </span>
      )}
      {formatDelta(value, format, opts)}
      {suffix && <span className="ml-1 font-normal text-muted">{suffix}</span>}
    </span>
  );
}
