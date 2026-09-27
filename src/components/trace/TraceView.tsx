'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CircleAlert } from 'lucide-react';
import { useJson } from '@/lib/data/client';
import { trace as traceSchema } from '@/lib/schemas/agentic';
import { duration, usdPrecise } from '@/lib/format';
import { Segmented } from '@/components/common/Segmented';
import { ErrorState, Skeleton } from '@/components/common/States';
import {
  KIND_COLOR,
  KIND_LABEL,
  describeSpan,
  filterRows,
  layoutTrace,
  rowSummary,
  spanCost,
  visibleRows,
  type Row,
  type TraceFilter,
} from './traceModel';

const PAGE = 120;

export function TraceLoader({ path }: { path: string }) {
  const res = useJson(path, traceSchema);
  if (res.status === 'loading') return <Skeleton className="h-[320px]" label="Loading trace" />;
  if (res.status === 'error')
    return <ErrorState message="The trace file didn't load. It'll refresh after the next run." />;
  return <TraceView spans={res.data.spans} truncated={res.data.truncated} dropped={res.data.dropped_spans} />;
}

export function TraceView({
  spans,
  truncated = false,
  dropped = 0,
}: {
  spans: Parameters<typeof layoutTrace>[0];
  truncated?: boolean;
  dropped?: number;
}) {
  const [view, setView] = useState<'timeline' | 'table'>('timeline');
  const [filter, setFilter] = useState<TraceFilter>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [all, setAll] = useState(false);
  const layout = useMemo(() => layoutTrace(spans), [spans]);
  const filtered = useMemo(() => filterRows(layout.rows, filter), [layout, filter]);
  const rows = useMemo(() => visibleRows(filtered, collapsed), [filtered, collapsed]);
  const shown = all ? rows : rows.slice(0, PAGE);
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div data-testid="trace-view">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          label="Trace view"
          size="sm"
          testId="trace-view-toggle"
          value={view}
          onChange={setView}
          options={[
            { value: 'timeline', label: 'Timeline' },
            { value: 'table', label: 'Table' },
          ]}
        />
        <Segmented
          label="Which spans"
          size="sm"
          testId="trace-filter"
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setAll(false);
          }}
          options={[
            { value: 'all', label: 'All spans' },
            { value: 'agentic', label: 'LLM, tools & guards' },
            { value: 'errors', label: 'Errors & retries' },
          ]}
        />
        {collapsed.size > 0 && (
          <button type="button" className="btn text-xs" onClick={() => setCollapsed(new Set())}>
            Expand all
          </button>
        )}
      </div>
      {truncated && (
        <p className="mb-2 text-xs text-muted">
          The trace was size-capped: {dropped} later span{dropped === 1 ? ' was' : 's were'} dropped. The
          summary above is still exact.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No spans match this filter.</p>
      ) : view === 'timeline' ? (
        <Timeline rows={shown} total={layout.total} collapsed={collapsed} onToggle={toggle} />
      ) : (
        <TraceTable rows={shown} />
      )}
      {rows.length > PAGE && (
        <button type="button" className="btn mt-2 text-xs" onClick={() => setAll((a) => !a)}>
          {all ? `Show the first ${PAGE}` : `Show all ${rows.length} spans`}
        </button>
      )}
    </div>
  );
}

function KindChip({ kind }: { kind: Row['span']['kind'] }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1 text-[11px] font-medium text-muted">
      <span className="h-2 w-2 rounded-sm" style={{ background: KIND_COLOR[kind] }} aria-hidden />
      {KIND_LABEL[kind]}
    </span>
  );
}

function Timeline({
  rows,
  total,
  collapsed,
  onToggle,
}: {
  rows: Row[];
  total: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="text-xs" data-testid="trace-timeline">
      <div className="mb-1 hidden grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 md:grid" aria-hidden>
        <span className="font-semibold uppercase tracking-wide text-muted">Span</span>
        <span className="relative h-4 text-muted">
          {ticks.map((f) => (
            <span
              key={f}
              className="absolute top-0 -translate-x-1/2 tabular-nums first:translate-x-0 last:-translate-x-full"
              style={{ left: `${f * 100}%` }}
            >
              {duration(total * f)}
            </span>
          ))}
        </span>
      </div>
      <ol className="divide-y divide-border rounded-md border border-border">
        {rows.map((r) => {
          const s = r.span;
          const left = (r.start / total) * 100;
          const width = Math.max(((r.dur ?? 0) / total) * 100, 0.4);
          const isCollapsed = collapsed.has(s.id);
          const detail = describeSpan(s);
          return (
            <li
              key={s.id}
              className="grid grid-cols-1 gap-1 px-2 py-1.5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-3"
              data-kind={s.kind}
            >
              <div
                className="flex min-w-0 items-start gap-1.5"
                style={{ paddingLeft: `${Math.min(r.depth, 6) * 12}px` }}
              >
                {r.childCount > 0 ? (
                  <button
                    type="button"
                    className="mt-0.5 shrink-0 rounded text-muted hover:text-text"
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${s.name} (${r.childCount} child span${r.childCount === 1 ? '' : 's'})`}
                    onClick={() => onToggle(s.id)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                ) : (
                  <span className="w-3.5 shrink-0" aria-hidden />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <KindChip kind={s.kind} />
                    <span className="break-all font-medium">{s.name}</span>
                    {s.status === 'error' && (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-bad">
                        <CircleAlert className="h-3 w-3" aria-hidden /> error
                      </span>
                    )}
                  </div>
                  {detail && <p className="mt-0.5 break-words text-muted">{detail}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative h-3 flex-1 rounded-sm bg-surface-2" aria-hidden>
                  <div
                    className={`absolute inset-y-0 rounded-sm ${s.status === 'error' ? 'ring-2 ring-bad' : ''}`}
                    style={{
                      left: `${Math.min(left, 99.6)}%`,
                      width: `${width}%`,
                      background: KIND_COLOR[s.kind],
                    }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right tabular-nums text-muted">{duration(r.dur)}</span>
              </div>
              <span className="sr-only">{rowSummary(r)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TraceTable({ rows }: { rows: Row[] }) {
  return (
    <div
      className="table-wrap max-h-[520px] overflow-y-auto rounded-md border border-border"
      data-testid="trace-table"
    >
      <table className="data-table text-xs">
        <caption className="sr-only">Every span of the latest run, in order, with timing and cost</caption>
        <thead className="sticky top-0 bg-surface">
          <tr>
            <th scope="col">Span</th>
            <th scope="col">Kind</th>
            <th scope="col" className="text-right">
              Start
            </th>
            <th scope="col" className="text-right">
              Duration
            </th>
            <th scope="col" className="text-right">
              Cost
            </th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.span.id}>
              <th scope="row" className="!normal-case !tracking-normal font-medium text-text">
                <span
                  style={{ paddingLeft: `${Math.min(r.depth, 6) * 10}px` }}
                  className="inline-block break-all"
                >
                  {r.span.name}
                </span>
              </th>
              <td className="whitespace-nowrap">{KIND_LABEL[r.span.kind]}</td>
              <td className="whitespace-nowrap text-right tabular-nums">+{duration(r.start)}</td>
              <td className="whitespace-nowrap text-right tabular-nums">{duration(r.dur)}</td>
              <td className="whitespace-nowrap text-right tabular-nums">{usdPrecise(spanCost(r.span))}</td>
              <td className="min-w-[14rem] break-words text-muted">
                {r.span.status === 'error' && <strong className="text-bad">Error. </strong>}
                {describeSpan(r.span) || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
