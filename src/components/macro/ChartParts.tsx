'use client';

import type { ReactNode } from 'react';
import { RANGES, type RangeId } from './helpers';

/** 2Y / 5Y / 10Y segmented control (buttons with aria-pressed). */
export function RangeToggle({
  value,
  onChange,
  label = 'Chart range',
}: {
  value: RangeId;
  onChange: (r: RangeId) => void;
  label?: string;
}) {
  return (
    <Segmented
      options={RANGES.map((r) => ({ id: r.id, label: r.label }))}
      value={value}
      onChange={onChange}
      label={label}
    />
  );
}

/** Segmented button group; each option is a toggle button with aria-pressed. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-md border border-border"
    >
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-[32px] px-3 text-xs font-semibold ${i > 0 ? 'border-l border-border' : ''} ${
            value === o.id ? 'bg-accent text-accent-contrast' : 'bg-surface text-text hover:bg-surface-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="btn text-xs" aria-pressed={open} onClick={onToggle}>
      {open ? 'Hide data table' : 'View data table'}
    </button>
  );
}

/** Small scrollable table of plotted data (newest first). */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: { key: string; cells: ReactNode[] }[];
}) {
  return (
    <div className="table-wrap mt-3 max-h-[280px] overflow-y-auto rounded-card border border-border">
      <table className="data-table num">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface">
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              {r.cells.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="font-normal">
                    {cell}
                  </th>
                ) : (
                  <td key={i}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function tooltipStyle(c: Record<string, string>) {
  return {
    contentStyle: {
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 8,
      color: c.text,
      fontSize: 12,
    },
    labelStyle: { color: c.text, fontWeight: 600 },
  };
}
