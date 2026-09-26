'use client';

import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
} from 'lucide-react';
import { grantsAll, type GrantsRow, type TopMatch } from '@/lib/schemas/grants';
import { currencyCompact, formatDate } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { useNow } from '@/lib/hooks';
import { useJson } from '@/lib/data/client';
import { SectionHeading } from '@/components/common/Methodology';
import { EmptyState, ErrorState, Skeleton } from '@/components/common/States';
import { RecommendationBadge } from './badges';
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  FIRST_SORT_DESC,
  NO_SET_ASIDE,
  csvFilename,
  daysLeft,
  facetOptions,
  filterRows,
  formatAgency,
  isFiltered,
  rowsToCsv,
  sortRows,
  sourceLabel,
  type GrantsFilters,
  type SortKey,
  type SortState,
  type SourceKey,
} from './grantsFilters';

export const PAGE_SIZE = 25;

function useColumns(now: Date): ColumnDef<GrantsRow>[] {
  return useMemo<ColumnDef<GrantsRow>[]>(
    () => [
      {
        id: 'fit',
        header: 'Fit',
        cell: ({ row: { original: r } }) =>
          r.fit == null ? (
            <span className="text-muted" title="Below the relevance threshold; not scored">
              —
            </span>
          ) : (
            <span className="flex flex-col items-start gap-0.5">
              <span className="num font-semibold">{r.fit}</span>
              <RecommendationBadge rec={r.recommendation} size="sm" />
            </span>
          ),
      },
      {
        id: 'title',
        header: 'Title',
        cell: ({ row: { original: r } }) => (
          <span className="block min-w-[14rem] max-w-[22rem]">
            <a href={r.url} className="link" target="_blank" rel="noopener noreferrer">
              {r.title}
              <span className="sr-only"> (opens {sourceLabel(r.source)} in a new tab)</span>
            </a>
            {r.is_new && (
              <span className="chip ml-1.5 border-accent px-1.5 text-[11px] font-semibold text-accent">
                NEW
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'agency',
        header: 'Agency',
        cell: ({ row: { original: r } }) => (
          <span className="block min-w-[10rem]">{formatAgency(r.agency)}</span>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        cell: ({ row: { original: r } }) => (
          <span className="whitespace-nowrap">{sourceLabel(r.source)}</span>
        ),
      },
      { id: 'type', header: 'Type', cell: ({ row: { original: r } }) => r.type || '—' },
      {
        id: 'naics',
        header: 'NAICS',
        cell: ({ row: { original: r } }) => (
          <span className="num">{r.naics.length ? r.naics.join(', ') : '—'}</span>
        ),
      },
      { id: 'set_aside', header: 'Set-aside', cell: ({ row: { original: r } }) => r.set_aside ?? '—' },
      {
        id: 'posted',
        header: 'Posted',
        cell: ({ row: { original: r } }) => (
          <span className="num whitespace-nowrap">{formatDate(r.posted)}</span>
        ),
      },
      {
        id: 'deadline',
        header: 'Deadline',
        cell: ({ row: { original: r } }) => {
          const d = daysLeft(r.deadline, now);
          return (
            <span className="num flex flex-col whitespace-nowrap">
              <span>{formatDate(r.deadline)}</span>
              {d != null && (
                <span className={`text-xs ${d < 7 ? 'font-semibold text-bad' : 'text-muted'}`}>
                  {d < 0 ? 'closed' : d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} left`}
                </span>
              )}
            </span>
          );
        },
      },
      {
        id: 'value',
        header: 'Value',
        cell: ({ row: { original: r } }) => (
          <span className={`num whitespace-nowrap ${r.value == null ? 'text-muted' : ''}`}>
            {currencyCompact(r.value)}
          </span>
        ),
      },
    ],
    [now],
  );
}

function SortIcon({ state }: { state: 'asc' | 'desc' | false }) {
  if (state === 'asc') return <ArrowUp className="h-3.5 w-3.5" aria-hidden />;
  if (state === 'desc') return <ArrowDown className="h-3.5 w-3.5" aria-hidden />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />;
}

function Select({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <select
        id={id}
        className="input w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface GrantsTableViewProps {
  rows: readonly GrantsRow[];
  topMatches?: readonly TopMatch[];
  /** Override the clock (tests). Defaults to `useNow()`. */
  now?: Date;
  pageSize?: number;
}

/** Presentational table: filters, sort, pagination, expand, CSV export over `rows`. */
export function GrantsTableView({
  rows,
  topMatches = [],
  now: nowProp,
  pageSize = PAGE_SIZE,
}: GrantsTableViewProps) {
  const clock = useNow();
  const now = nowProp ?? clock;
  const [filters, setFilters] = useState<GrantsFilters>(DEFAULT_FILTERS);
  const [minFitText, setMinFitText] = useState('');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const ids = { search: useId(), minfit: useId(), newOnly: useId(), agency: useId() };

  const facets = useMemo(() => facetOptions(rows), [rows]);
  const topById = useMemo(() => new Map(topMatches.map((m) => [m.id, m])), [topMatches]);
  const visible = useMemo(() => sortRows(filterRows(rows, filters, now), sort), [rows, filters, now, sort]);
  const columns = useColumns(now);

  const update = (patch: Partial<GrantsFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const table = useReactTable({
    data: visible,
    columns,
    getRowId: (r) => r.id,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualSorting: true,
    manualFiltering: true,
    autoResetPageIndex: false,
  });

  const pageCount = Math.max(1, table.getPageCount());
  const pageIndex = Math.min(pagination.pageIndex, pageCount - 1);

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: FIRST_SORT_DESC[key] }));
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = () => downloadCsv(csvFilename(now), rowsToCsv(visible));

  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    setMinFitText('');
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const colCount = columns.length + 1;

  return (
    <div className="space-y-4">
      <form
        className="card grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Filter matches"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
          <label htmlFor={ids.search} className="text-xs font-medium text-muted">
            Search
          </label>
          <input
            id={ids.search}
            type="search"
            className="input w-full"
            placeholder="Title or agency"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
          />
        </div>
        <Select
          label="Source"
          value={filters.source}
          onChange={(v) => update({ source: v as SourceKey | '' })}
          options={[
            { value: '', label: 'Any source' },
            ...facets.sources.map((s) => ({ value: s, label: sourceLabel(s) })),
          ]}
        />
        <Select
          label="Type"
          value={filters.type}
          onChange={(v) => update({ type: v })}
          options={[{ value: '', label: 'Any type' }, ...facets.types.map((t) => ({ value: t, label: t }))]}
        />
        <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
          <span id={ids.agency} className="text-xs font-medium text-muted">
            Agency
          </span>
          <details className="group rounded-md border border-border bg-surface">
            <summary className="flex min-h-[36px] cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-sm [&::-webkit-details-marker]:hidden">
              <span className="truncate">
                {filters.agencies.length === 0
                  ? 'Any agency'
                  : filters.agencies.length === 1
                    ? formatAgency(filters.agencies[0])
                    : `${filters.agencies.length} agencies selected`}
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <fieldset
              className="max-h-56 space-y-1 overflow-y-auto border-t border-border px-2.5 py-2"
              aria-labelledby={ids.agency}
            >
              {facets.agencies.map((a) => (
                <label key={a} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={filters.agencies.includes(a)}
                    onChange={(e) =>
                      update({
                        agencies: e.target.checked
                          ? [...filters.agencies, a]
                          : filters.agencies.filter((x) => x !== a),
                      })
                    }
                  />
                  <span>{formatAgency(a)}</span>
                </label>
              ))}
              {filters.agencies.length > 0 && (
                <button type="button" className="link mt-1 text-xs" onClick={() => update({ agencies: [] })}>
                  Clear agencies
                </button>
              )}
            </fieldset>
          </details>
        </div>
        <Select
          label="Set-aside"
          value={filters.setAside}
          onChange={(v) => update({ setAside: v })}
          options={[
            { value: '', label: 'Any set-aside' },
            ...facets.setAsides.map((s) => ({ value: s, label: s })),
            ...(facets.hasNoSetAside ? [{ value: NO_SET_ASIDE, label: 'None (full and open)' }] : []),
          ]}
        />
        <Select
          label="NAICS"
          value={filters.naics}
          onChange={(v) => update({ naics: v })}
          options={[{ value: '', label: 'Any NAICS' }, ...facets.naics.map((n) => ({ value: n, label: n }))]}
        />
        <Select
          label="Closing within"
          testId="grants-filter-closing"
          value={filters.closingWithin == null ? '' : String(filters.closingWithin)}
          onChange={(v) => update({ closingWithin: v === '' ? null : Number(v) })}
          options={[
            { value: '', label: 'Any time' },
            { value: '7', label: '7 days' },
            { value: '14', label: '14 days' },
            { value: '30', label: '30 days' },
          ]}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={ids.minfit} className="text-xs font-medium text-muted">
            Minimum fit
          </label>
          <input
            id={ids.minfit}
            data-testid="grants-filter-minfit"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            placeholder="0–100"
            className="input num w-full"
            value={minFitText}
            onChange={(e) => {
              setMinFitText(e.target.value);
              const n = Number(e.target.value);
              update({
                minFit: e.target.value === '' || !Number.isFinite(n) ? 0 : Math.max(0, Math.min(100, n)),
              });
            }}
          />
        </div>
        <div className="flex min-w-0 items-end gap-3 sm:col-span-2 lg:col-span-2">
          <label htmlFor={ids.newOnly} className="flex min-h-[36px] items-center gap-2 text-sm">
            <input
              id={ids.newOnly}
              type="checkbox"
              checked={filters.newOnly}
              onChange={(e) => update({ newOnly: e.target.checked })}
            />
            New only
          </label>
          {isFiltered(filters) && (
            <button type="button" className="btn ml-auto" onClick={reset}>
              Reset filters
            </button>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" aria-live="polite">
          <span className="num font-semibold text-text">{visible.length}</span> of{' '}
          <span className="num">{rows.length}</span> rows
          {isFiltered(filters) ? ' match the filters' : ''}
        </p>
        <button
          type="button"
          className="btn"
          onClick={exportCsv}
          disabled={visible.length === 0}
          data-testid="grants-export"
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV <span className="sr-only">({visible.length} filtered rows)</span>
        </button>
      </div>

      <div className="card table-wrap">
        <table className="data-table" data-testid="grants-table">
          <caption className="sr-only">
            Opportunities matching the profile, sorted by {sort.key.replace('_', '-')}{' '}
            {sort.desc ? 'descending' : 'ascending'}
          </caption>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                <th scope="col" className="w-8">
                  <span className="sr-only">Details</span>
                </th>
                {hg.headers.map((h) => {
                  const key = h.column.id as SortKey;
                  const state = sort.key === key ? (sort.desc ? 'desc' : 'asc') : false;
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={state === 'asc' ? 'ascending' : state === 'desc' ? 'descending' : 'none'}
                      className="whitespace-nowrap"
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-text"
                        onClick={() => toggleSort(key)}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <SortIcon state={state} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={colCount}>
                  <EmptyState title="No rows match these filters">
                    <button type="button" className="btn" onClick={reset}>
                      Reset filters
                    </button>
                  </EmptyState>
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => {
              const r = row.original;
              const isOpen = expanded.has(r.id);
              const detailId = `grants-detail-${r.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
              const tm = r.in_top ? topById.get(r.id) : undefined;
              return (
                <Fragment key={row.id}>
                  <tr data-testid="grants-row" className={isOpen ? 'bg-surface-2' : undefined}>
                    <td className="w-8 pr-0">
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-surface-2"
                        aria-expanded={isOpen}
                        aria-controls={isOpen ? detailId : undefined}
                        onClick={() => toggleExpanded(r.id)}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        ) : (
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        )}
                        <span className="sr-only">
                          {isOpen ? 'Hide' : 'Show'} details for {r.title}
                        </span>
                      </button>
                    </td>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                  {isOpen && (
                    <tr id={detailId}>
                      <td colSpan={colCount} className="bg-surface-2">
                        <RowDetail row={r} match={tm} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav
        className="flex flex-wrap items-center justify-between gap-2 text-sm"
        aria-label="Table pagination"
      >
        <p className="num text-muted">
          Page {pageIndex + 1} of {pageCount} · {visible.length} rows
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous<span className="sr-only"> page</span>
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next<span className="sr-only"> page</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function RowDetail({ row, match }: { row: GrantsRow; match?: TopMatch }) {
  const s = match?.summary;
  return (
    <div className="max-w-3xl space-y-3 py-1 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Why it matches</p>
        {row.reasons.length ? (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {row.reasons.map((x) => (
              <li key={x} className="chip">
                {x}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">—</p>
        )}
        <p className="mt-1 text-xs text-muted">
          Relevance pre-score: <span className="num">{row.relevance}</span>/100
          {row.fit == null && ' · below the relevance threshold, so not scored by the model'}
        </p>
      </div>
      {s && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {s.narrative_source === 'template' ? 'Template summary' : 'AI-generated summary'}
          </p>
          <p className="leading-relaxed">{s.what_they_want}</p>
          {s.why_fit.length > 0 && (
            <ul className="list-disc pl-5">
              {s.why_fit.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="font-semibold">Risks</p>
              <ul className="list-disc pl-5">
                {s.risks.length ? s.risks.map((x) => <li key={x}>{x}</li>) : <li>None noted</li>}
              </ul>
            </div>
            <div>
              <p className="font-semibold">Next steps</p>
              <ul className="list-disc pl-5">
                {s.next_steps.length ? s.next_steps.map((x) => <li key={x}>{x}</li>) : <li>—</li>}
              </ul>
            </div>
          </div>
          {match.red_flags.length > 0 && <p className="text-bad">Red flags: {match.red_flags.join('; ')}</p>}
        </div>
      )}
      <a
        href={row.url}
        className="link inline-flex items-center gap-1"
        target="_blank"
        rel="noopener noreferrer"
      >
        View on {sourceLabel(row.source)}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}

/** Loads `grants/all.json` on demand (button or when scrolled into view) and renders the table. */
export function GrantsTable({
  topMatches = [],
  expectedCount,
}: {
  topMatches?: readonly TopMatch[];
  expectedCount?: number;
}) {
  const [requested, setRequested] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const state = useJson(requested ? 'grants/all.json' : null, grantsAll);

  useEffect(() => {
    if (requested || !ref.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setRequested(true);
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [requested]);

  return (
    <section aria-labelledby="all-matches" ref={ref}>
      <SectionHeading id="all-matches">All matches</SectionHeading>
      {!requested ? (
        <div className="card flex flex-col items-start gap-3 p-4">
          <p className="text-sm text-muted">
            The full list covers every active opportunity that passed the hard filters, including ones below
            the relevance threshold.
          </p>
          <button type="button" className="btn-primary" onClick={() => setRequested(true)}>
            Load all{expectedCount != null ? ` ${expectedCount}` : ''} matches
          </button>
        </div>
      ) : state.status === 'loading' ? (
        <div className="space-y-3">
          <Skeleton className="h-40" label="Loading all matches" />
          <Skeleton className="h-96" label="Loading table" />
        </div>
      ) : state.status === 'error' ? (
        <ErrorState />
      ) : state.data.rows.length === 0 ? (
        <EmptyState title="No active matches" />
      ) : (
        <GrantsTableView rows={state.data.rows} topMatches={topMatches} />
      )}
    </section>
  );
}
