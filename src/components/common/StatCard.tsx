import type { GoodDirection, StatFormat } from '@/lib/schemas/common';
import { formatValue, type FormatOptions } from '@/lib/format';
import { Delta } from './Delta';
import { Sparkline } from './Sparkline';

export interface StatCardProps {
  label: string;
  value: number | null | undefined;
  format: StatFormat;
  delta?: number | null;
  deltaFormat?: StatFormat | null;
  deltaLabel?: string;
  goodDirection?: GoodDirection | null;
  sparkline?: (number | null)[];
  opts?: FormatOptions;
  size?: 'sm' | 'md';
  footnote?: React.ReactNode;
}

/** A big number with a semantic up/down delta (SPEC_WEBSITE §5). */
export function StatCard({
  label,
  value,
  format,
  delta,
  deltaFormat,
  deltaLabel,
  goodDirection,
  sparkline,
  opts,
  size = 'md',
  footnote,
}: StatCardProps) {
  return (
    <div className={`card flex flex-col gap-1 ${size === 'sm' ? 'p-3' : 'p-4'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className={`num font-semibold ${size === 'sm' ? 'text-lg' : 'text-xl'}`}>
          {formatValue(value, format, opts)}
        </p>
        {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} label={`${label} trend`} />}
      </div>
      {delta !== undefined && (
        <p className="text-sm">
          <Delta
            value={delta}
            format={deltaFormat ?? format}
            goodDirection={goodDirection}
            opts={opts}
            suffix={deltaLabel}
          />
        </p>
      )}
      {footnote && <p className="text-xs text-muted">{footnote}</p>}
    </div>
  );
}
