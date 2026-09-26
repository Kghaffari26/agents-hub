import type { RunStatus } from './schemas/common';

/** Client-side stale detection (SPEC_WEBSITE §3): older than 2 × the expected interval. */
export function isStale(
  lastRunAt: string | null | undefined,
  expectedIntervalHours: number,
  now: Date = new Date(),
): boolean {
  if (!lastRunAt) return true;
  const t = new Date(lastRunAt).getTime();
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > 2 * expectedIntervalHours * 3_600_000;
}

/** Combine the manifest's status with the client-side check. `failed` always wins. */
export function effectiveStatus(
  status: RunStatus,
  lastRunAt: string | null | undefined,
  expectedIntervalHours: number,
  now: Date = new Date(),
): RunStatus {
  if (status === 'failed') return 'failed';
  if (status === 'stale' || isStale(lastRunAt, expectedIntervalHours, now)) return 'stale';
  return 'ok';
}
