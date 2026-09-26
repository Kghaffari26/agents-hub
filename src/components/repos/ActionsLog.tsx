import { Ban, CheckCircle2, Clock } from 'lucide-react';
import type { RepoAction } from '@/lib/schemas/repoMaint';
import { DASH } from '@/lib/format';
import { actionLabel, issueUrl, shortName, type ActionStatus, type Mode } from './labels';

const STATUS: Record<ActionStatus, { Icon: typeof Clock; label: string; cls: string }> = {
  planned: { Icon: Clock, label: 'Planned', cls: 'border-neutral text-neutral' },
  applied: { Icon: CheckCircle2, label: 'Applied', cls: 'border-good text-good' },
  skipped: { Icon: Ban, label: 'Skipped', cls: 'border-border text-muted' },
};

export function StatusPill({ status }: { status: ActionStatus }) {
  const { Icon, label, cls } = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border bg-surface px-2 py-0.5 text-xs font-semibold ${cls}`}
      data-status={status}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

function Detail({ detail }: { detail: RepoAction['detail'] }) {
  if (detail == null || (Array.isArray(detail) && !detail.length)) return <>{DASH}</>;
  if (Array.isArray(detail)) {
    return (
      <div className="flex flex-wrap gap-1">
        {detail.map((d) => (
          <span key={d} className="chip whitespace-nowrap">
            {d}
          </span>
        ))}
      </div>
    );
  }
  return <>{detail}</>;
}

/** What the agent did this run, or would have done in report mode (SPEC_WEBSITE §7.5 item 6). */
export function ActionsLog({ actions, mode }: { actions: RepoAction[]; mode: Mode }) {
  const counts = actions.reduce<Record<ActionStatus, number>>(
    (acc, a) => ({ ...acc, [a.status]: acc[a.status] + 1 }),
    { planned: 0, applied: 0, skipped: 0 },
  );
  return (
    <div className="space-y-3" data-testid="actions-log">
      <p className="text-sm text-muted">
        {mode === 'report'
          ? 'Report mode: the agent lists what it would do; nothing below was written to GitHub.'
          : 'Apply mode: writes happen only where every safety gate passes; anything else is logged as planned with the reason. In report mode the agent only lists what it would do.'}{' '}
        <span className="num">
          {counts.applied} applied · {counts.planned} planned · {counts.skipped} skipped.
        </span>
      </p>
      {actions.length === 0 ? (
        <p className="text-sm text-muted">No actions this run.</p>
      ) : (
        <div
          className="table-wrap card"
          tabIndex={0}
          role="region"
          aria-label="Actions log table (scrolls horizontally)"
        >
          <table className="data-table min-w-[720px]">
            <caption className="sr-only">Actions from the latest run</caption>
            <thead>
              <tr>
                <th scope="col">Repo</th>
                <th scope="col">Action</th>
                <th scope="col">Target</th>
                <th scope="col">Detail</th>
                <th scope="col">Status</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a, i) => (
                <tr key={`${a.repo}-${a.type}-${a.target ?? 'x'}-${i}`}>
                  <td className="whitespace-nowrap text-muted" title={a.repo}>
                    {shortName(a.repo)}
                  </td>
                  <td className="whitespace-nowrap">{actionLabel(a.type)}</td>
                  <td className="num">
                    {a.target != null ? (
                      <a href={issueUrl(a.repo, a.target)} className="link">
                        #{a.target}
                      </a>
                    ) : (
                      DASH
                    )}
                  </td>
                  <td>
                    <Detail detail={a.detail} />
                  </td>
                  <td>
                    <StatusPill status={a.status} />
                  </td>
                  <td className="text-muted">{a.reason ?? DASH}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
