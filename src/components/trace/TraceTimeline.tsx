'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/common/States';

// The trace view (and the trace.json schema) load only when the panel is opened.
const TraceLoader = dynamic(() => import('./TraceView').then((m) => m.TraceLoader), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px]" label="Loading trace" />,
});
/**
 * The expandable part of the Run trace panel. trace.json (up to 256 KB) is fetched only when the
 * panel is opened, so it never weighs on the page. Two views over the same rows: a timeline
 * (bars on a shared time axis, subtrees collapsible) and a plain text table.
 */
export function TraceTimeline({ path, spanCount }: { path: string; spanCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="group mt-3 rounded-card border border-border"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      data-testid="trace-details"
    >
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm font-medium">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
        Show every span ({spanCount})
      </summary>
      <div className="border-t border-border p-3">{open && <TraceLoader path={path} />}</div>
    </details>
  );
}
