import { AlertTriangle } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

/** "Last update failed at …; showing data from …" (SPEC_WEBSITE §5, §8). */
export function FailureBanner({ failedAt, dataFrom }: { failedAt: string; dataFrom?: string | null }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-card border border-bad/40 bg-bad/10 p-3 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden />
      <p>
        Last update failed at <strong>{formatDateTime(failedAt)}</strong>
        {dataFrom ? <>; showing data from {formatDateTime(dataFrom)}.</> : '.'}
      </p>
    </div>
  );
}
