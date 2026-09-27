import type { SpanKind, TraceSpan } from '@/lib/schemas/agentic';
import { duration, usdPrecise } from '@/lib/format';

/** Pure helpers for the Run trace panel (unit-tested; no React). */

export const KIND_LABEL: Record<SpanKind, string> = {
  run: 'Run',
  phase: 'Phase',
  agent_loop: 'Agent loop',
  llm_call: 'LLM call',
  tool_call: 'Tool call',
  http: 'HTTP',
  guard: 'Guard',
  custom: 'Custom',
};

/** CSS color token per kind; every kind is also labeled in text (never color alone). */
export const KIND_COLOR: Record<SpanKind, string> = {
  run: 'var(--text-muted)',
  phase: 'var(--text-muted)',
  agent_loop: 'var(--chart-4)',
  llm_call: 'var(--chart-1)',
  tool_call: 'var(--chart-3)',
  http: 'var(--border)',
  guard: 'var(--chart-2)',
  custom: 'var(--text-muted)',
};

export interface Row {
  span: TraceSpan;
  depth: number;
  /** ms from the earliest span start */
  start: number;
  dur: number | null;
  childCount: number;
  /** ids of all ancestors, root first */
  ancestors: string[];
}

export interface TraceLayout {
  rows: Row[];
  /** ms from first start to last end */
  total: number;
}

/**
 * Depth-first order (children by start time), with offsets relative to the first span. Spans
 * whose parent is missing (dropped by truncation) are treated as roots.
 */
export function layoutTrace(spans: TraceSpan[]): TraceLayout {
  if (!spans.length) return { rows: [], total: 0 };
  const t = (s: TraceSpan) => Date.parse(s.started_at);
  const t0 = Math.min(...spans.map(t));
  const ids = new Set(spans.map((s) => s.id));
  const kids = new Map<string | null, TraceSpan[]>();
  for (const s of spans) {
    const p = s.parent_id && ids.has(s.parent_id) ? s.parent_id : null;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p)!.push(s);
  }
  for (const list of kids.values())
    list.sort((a, b) => t(a) - t(b) || a.id.localeCompare(b.id, 'en', { numeric: true }));
  const rows: Row[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number, ancestors: string[]) => {
    for (const s of kids.get(parent) ?? []) {
      if (seen.has(s.id)) continue; // defensive: cycles in malformed input
      seen.add(s.id);
      rows.push({
        span: s,
        depth,
        start: t(s) - t0,
        dur: s.duration_ms,
        childCount: kids.get(s.id)?.length ?? 0,
        ancestors,
      });
      walk(s.id, depth + 1, [...ancestors, s.id]);
    }
  };
  walk(null, 0, []);
  const total = Math.max(...rows.map((r) => r.start + (r.dur ?? 0)), 1);
  return { rows, total };
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const tokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n));

/** One-line, human description of a span's attrs (model, tokens, cost, status…). */
export function describeSpan(s: TraceSpan): string {
  const a = s.attrs;
  const parts: string[] = [];
  switch (s.kind) {
    case 'llm_call': {
      const model = str(a.model);
      if (model) parts.push(model);
      const tin = num(a.input_tokens);
      const tout = num(a.output_tokens);
      if (tin != null || tout != null) parts.push(`${tokens(tin ?? 0)} in / ${tokens(tout ?? 0)} out tokens`);
      const cached = num(a.cache_read_tokens);
      if (cached) parts.push(`${tokens(cached)} cached`);
      if (num(a.usd) != null) parts.push(usdPrecise(num(a.usd)));
      if (str(a.stop_reason)) parts.push(`stop: ${a.stop_reason}`);
      break;
    }
    case 'tool_call': {
      if (num(a.step) != null) parts.push(`step ${a.step}`);
      if (a.pending_approval === true) parts.push('queued for human approval');
      if (a.is_error === true) parts.push('tool error');
      const out = str(a.output);
      if (out) parts.push(`→ ${out.length > 80 ? `${out.slice(0, 79)}…` : out}`);
      break;
    }
    case 'http': {
      if (num(a.status) != null) parts.push(String(a.status));
      if (a.from_cache === true) parts.push('from cache');
      const retries = num(a.retries);
      if (retries) parts.push(`${retries} ${retries === 1 ? 'retry' : 'retries'}`);
      const url = str(a.url);
      if (url) {
        try {
          const u = new URL(url);
          parts.push(u.pathname.length > 48 ? `${u.pathname.slice(0, 47)}…` : u.pathname);
        } catch {
          /* not a URL */
        }
      }
      break;
    }
    case 'guard': {
      const attempts = num(a.attempts);
      const outcome = str(a.outcome);
      if (outcome) parts.push(outcome.replace(/_/g, ' '));
      if (attempts != null) parts.push(`${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}`);
      if (Array.isArray(a.unsupported) && a.unsupported.length)
        parts.push(`unsupported: ${a.unsupported.map(String).join(', ')}`);
      break;
    }
    case 'agent_loop': {
      if (num(a.steps) != null) parts.push(`${a.steps} steps`);
      if (num(a.tool_calls) != null) parts.push(`${a.tool_calls} tool calls`);
      if (str(a.stop_reason)) parts.push(`stop: ${a.stop_reason}`);
      if (num(a.usd) != null) parts.push(usdPrecise(num(a.usd)));
      break;
    }
    default:
      break;
  }
  if (s.status === 'error') parts.push(s.error ? `error: ${s.error}` : 'error');
  return parts.join(' · ');
}

/** Cost attributed to a span (LLM calls and agent loops carry `usd`). */
export function spanCost(s: TraceSpan): number | null {
  return s.kind === 'llm_call' || s.kind === 'agent_loop' ? num(s.attrs.usd) : null;
}

export type TraceFilter = 'all' | 'agentic' | 'errors';

/** Keep rows matching the filter, plus their ancestors so the tree still reads. */
export function filterRows(rows: Row[], filter: TraceFilter): Row[] {
  if (filter === 'all') return rows;
  const match = (r: Row) =>
    filter === 'errors'
      ? r.span.status === 'error' || (r.span.kind === 'guard' && Number(r.span.attrs.attempts ?? 1) > 1)
      : ['llm_call', 'tool_call', 'agent_loop', 'guard'].includes(r.span.kind);
  const keep = new Set<string>();
  for (const r of rows) {
    if (match(r)) {
      keep.add(r.span.id);
      r.ancestors.forEach((a) => keep.add(a));
    }
  }
  return rows.filter((r) => keep.has(r.span.id));
}

/** Rows hidden under a collapsed ancestor are dropped. */
export function visibleRows(rows: Row[], collapsed: Set<string>): Row[] {
  if (!collapsed.size) return rows;
  return rows.filter((r) => !r.ancestors.some((a) => collapsed.has(a)));
}

export function rowSummary(r: Row): string {
  return `${KIND_LABEL[r.span.kind]} ${r.span.name}, starts at +${duration(r.start)}, took ${
    r.dur == null ? 'an unknown time (never ended)' : duration(r.dur)
  }${r.span.status === 'error' ? ', failed' : ''}.`;
}
