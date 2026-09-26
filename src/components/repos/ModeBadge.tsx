import { Eye, PenLine } from 'lucide-react';
import { MODE_EXPLANATION, MODE_LABEL, type Mode } from './labels';

/** "Report mode (read-only)" / "Apply mode" pill. Icon + text, never color alone. */
export function ModeBadge({ mode }: { mode: Mode }) {
  const Icon = mode === 'report' ? Eye : PenLine;
  const cls = mode === 'report' ? 'border-border text-text' : 'border-accent text-accent';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-0.5 text-xs font-semibold ${cls}`}
      title={MODE_EXPLANATION[mode]}
      data-testid="mode-badge"
      data-mode={mode}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {MODE_LABEL[mode]}
    </span>
  );
}
