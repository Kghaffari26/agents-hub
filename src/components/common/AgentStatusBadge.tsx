import type { RunStatus } from '@/lib/schemas/common';

const STYLE: Record<RunStatus, { cls: string; label: string }> = {
  ok: { cls: 'border-good/40 text-good', label: 'Live' },
  stale: { cls: 'border-neutral/50 text-neutral', label: 'Stale' },
  failed: { cls: 'border-bad/50 text-bad', label: 'Failed' },
};

/** ok / stale / failed pill. Text + dot, never color alone. */
export function AgentStatusBadge({ status }: { status: RunStatus }) {
  const s = STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}
      data-status={status}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
    </span>
  );
}
