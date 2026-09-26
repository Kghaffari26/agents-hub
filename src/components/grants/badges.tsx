import { CheckCircle2, CircleDot, MinusCircle } from 'lucide-react';
import type { Recommendation } from '@/lib/schemas/grants';
import { sourceLabel, type SourceKey } from './grantsFilters';

const REC_STYLE: Record<Recommendation, { cls: string; Icon: typeof CheckCircle2; iconCls: string }> = {
  Pursue: {
    cls: 'border-[color-mix(in_srgb,var(--good)_60%,transparent)] bg-[color-mix(in_srgb,var(--good)_10%,transparent)]',
    Icon: CheckCircle2,
    iconCls: 'text-good',
  },
  Consider: {
    cls: 'border-[color-mix(in_srgb,var(--neutral)_60%,transparent)] bg-[color-mix(in_srgb,var(--neutral)_10%,transparent)]',
    Icon: CircleDot,
    iconCls: 'text-neutral',
  },
  Pass: { cls: 'border-border bg-surface-2', Icon: MinusCircle, iconCls: 'text-muted' },
};

/** Pursue / Consider / Pass. Text is always visible; color and icon are secondary cues. */
export function RecommendationBadge({
  rec,
  size = 'md',
}: {
  rec: Recommendation | null | undefined;
  size?: 'sm' | 'md';
}) {
  if (!rec) return <span className="text-muted">—</span>;
  const s = REC_STYLE[rec];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold text-text ${s.cls} ${
        size === 'sm' ? 'px-2 py-0 text-xs' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      <s.Icon className={`h-3.5 w-3.5 ${s.iconCls}`} aria-hidden />
      {rec}
    </span>
  );
}

export function SourceBadge({ source }: { source: SourceKey }) {
  return <span className="chip whitespace-nowrap">{sourceLabel(source)}</span>;
}

/** Color token (CSS variable) for a recommendation, used by the timeline. */
export const REC_COLOR_VAR: Record<Recommendation, string> = {
  Pursue: 'var(--good)',
  Consider: 'var(--neutral)',
  Pass: 'var(--text-muted)',
};
