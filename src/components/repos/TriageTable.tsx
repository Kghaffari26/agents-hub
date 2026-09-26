import { Check, MessageSquare, Minus } from 'lucide-react';
import type { Repo, TriageItem } from '@/lib/schemas/repoMaint';
import { DASH } from '@/lib/format';
import { RelTime } from './RelTime';
import { capitalize, priorityLabel, shortName, type Mode } from './labels';

type Row = { repo: string; item: TriageItem };

const CONF_CLS: Record<TriageItem['confidence'], string> = {
  high: 'text-good border-good',
  medium: 'text-neutral border-neutral',
  low: 'text-muted border-border',
};

function Applied({ applied }: { applied: TriageItem['applied'] }) {
  if (!applied.labels.length && !applied.commented) {
    return (
      <span className="inline-flex items-center gap-1 text-muted">
        <Minus className="h-3.5 w-3.5" aria-hidden /> Not applied
      </span>
    );
  }
  return (
    <div className="space-y-1">
      {applied.labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <Check className="h-3.5 w-3.5 text-good" aria-hidden />
          <span className="sr-only">Labels applied:</span>
          {applied.labels.map((l) => (
            <span key={l} className="chip">
              {l}
            </span>
          ))}
        </div>
      )}
      {applied.commented && (
        <span className="inline-flex items-center gap-1 text-good">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Commented
        </span>
      )}
    </div>
  );
}

/** Untriaged issues across all repos (SPEC_WEBSITE §7.5 item 3). */
export function TriageTable({ repos, mode }: { repos: Repo[]; mode: Mode }) {
  const rows: Row[] = repos.flatMap((r) => r.triage.map((item) => ({ repo: r.full_name, item })));
  if (!rows.length) {
    return (
      <p className="text-sm text-muted" data-testid="triage-table">
        No untriaged issues. Nice.
      </p>
    );
  }
  const showApplied = mode === 'apply';
  return (
    <div
      className="table-wrap card"
      data-testid="triage-table"
      tabIndex={0}
      role="region"
      aria-label="Triage queue table (scrolls horizontally)"
    >
      <table className={`data-table ${showApplied ? 'min-w-[1180px]' : 'min-w-[1040px]'}`}>
        <caption className="sr-only">Untriaged issues with the agent&apos;s suggested triage</caption>
        <thead>
          <tr>
            <th scope="col">Repo</th>
            <th scope="col">Issue</th>
            <th scope="col">Type</th>
            <th scope="col">Suggested labels</th>
            <th scope="col">Priority</th>
            <th scope="col">Confidence</th>
            <th scope="col">Missing info</th>
            <th scope="col">Possible duplicates</th>
            <th scope="col">Opened</th>
            {showApplied && <th scope="col">Applied</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ repo, item }) => (
            <tr key={`${repo}#${item.number}`}>
              <td className="whitespace-nowrap text-muted" title={repo}>
                {shortName(repo)}
              </td>
              <td className="min-w-[220px]">
                <a href={item.url} className="link">
                  <span className="num">#{item.number}</span> {item.title}
                </a>
                {item.summary && <p className="mt-0.5 text-xs text-muted">{item.summary}</p>}
              </td>
              <td>{capitalize(item.classification)}</td>
              <td>
                {item.suggested_labels.length ? (
                  <div className="flex flex-wrap gap-1">
                    {item.suggested_labels.map((l) => (
                      <span key={l} className="chip whitespace-nowrap">
                        {l}
                      </span>
                    ))}
                  </div>
                ) : (
                  DASH
                )}
              </td>
              <td className="num">{priorityLabel(item.priority)}</td>
              <td>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${CONF_CLS[item.confidence]}`}
                >
                  {capitalize(item.confidence)}
                </span>
              </td>
              <td>
                {item.missing_info.length ? (
                  <ul className="space-y-0.5">
                    {item.missing_info.map((m) => (
                      <li key={m} className="flex items-start gap-1.5">
                        <span aria-hidden className="leading-5">
                          ☐
                        </span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  DASH
                )}
              </td>
              <td>
                {item.duplicates.length ? (
                  <ul className="space-y-0.5">
                    {item.duplicates.map((d) => (
                      <li key={d.number} className="whitespace-nowrap">
                        <a href={d.url} className="link num" title={d.title}>
                          #{d.number}
                        </a>{' '}
                        <span className="num">{Math.round(d.similarity * 100)}%</span>
                        <span className="text-muted"> similar · {d.state}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  DASH
                )}
              </td>
              <td className="whitespace-nowrap">
                <span className="block">@{item.author}</span>
                <span className="text-xs text-muted">
                  <RelTime at={item.created_at} />
                </span>
              </td>
              {showApplied && (
                <td>
                  <Applied applied={item.applied} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
