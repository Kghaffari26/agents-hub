import type { EvalEntry } from '@/lib/schemas/agentic';

/** Pure helpers for eval history (unit-tested). */

export interface SuiteSummary {
  suite: string;
  latest: EvalEntry;
  previous: EvalEntry | null;
  runs: number;
  /** score name → [latest, change vs previous run (null on the first run)] */
  scores: { name: string; value: number; delta: number | null }[];
}

export function bySuite(entries: EvalEntry[]): Map<string, EvalEntry[]> {
  const m = new Map<string, EvalEntry[]>();
  for (const e of [...entries].sort((a, b) => a.ts.localeCompare(b.ts))) {
    if (!m.has(e.suite)) m.set(e.suite, []);
    m.get(e.suite)!.push(e);
  }
  return m;
}

export function summarize(entries: EvalEntry[]): SuiteSummary[] {
  return [...bySuite(entries)].map(([suite, list]) => {
    const latest = list[list.length - 1];
    const previous = list.length > 1 ? list[list.length - 2] : null;
    const names = Object.keys(latest.scores);
    if (latest.pass_rate != null && !names.includes('pass_rate')) names.push('pass_rate');
    const val = (e: EvalEntry | null, n: string) =>
      e == null ? null : n === 'pass_rate' && !(n in e.scores) ? e.pass_rate : (e.scores[n] ?? null);
    return {
      suite,
      latest,
      previous,
      runs: list.length,
      scores: names.map((name) => {
        const v = val(latest, name)!;
        const p = val(previous, name);
        return { name, value: v, delta: p == null ? null : Math.round((v - p) * 1000) / 1000 };
      }),
    };
  });
}

/** "numbers_grounded" → "Numbers grounded" */
export function scoreLabel(name: string): string {
  const s = name.replace(/[_-]+/g, ' ').trim();
  const fixed = s.replace(/\b(llm|mae|fomc|mcp|api|pr)\b/gi, (w) => w.toUpperCase());
  return fixed.charAt(0).toUpperCase() + fixed.slice(1);
}

/** Rows for a suite chart: one per run, `score name → value (0–1)`. */
export function chartRows(list: EvalEntry[]) {
  return list.map((e) => ({
    ts: e.ts,
    ...e.scores,
    ...(e.pass_rate != null && !('pass_rate' in e.scores) ? { pass_rate: e.pass_rate } : {}),
  })) as ({ ts: string } & Record<string, number>)[];
}
