import { Search } from 'lucide-react';
import type { MacroInvestigation } from '@/lib/schemas/agentic';
import type { IndicatorLite } from './helpers';
import { fmtValue } from './helpers';
import { formatDate } from '@/lib/format';
import { InlineText, LoopMeta, ToolTrail } from '../agentic/LoopParts';

const STOP_TEXT: Record<string, string> = {
  finished: 'finished',
  max_steps: 'stopped at its step budget',
  max_usd: 'stopped at its cost budget',
  max_seconds: 'stopped at its time budget',
  run_budget: 'stopped at the run budget',
  end_turn_without_finish: 'ended without a result',
  refusal: 'model refused',
  max_tokens: 'output truncated',
  guard_failed: 'failed the number guard',
};

/** "FOMC decision, Sep 16, 2026" or "New CPI (all items) release". */
export function triggerLabel(t: MacroInvestigation['trigger'], names: Map<string, string>): string {
  const date = t.event_id.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (t.type === 'fomc_decision') return `FOMC decision${date ? `, ${formatDate(date)}` : ''}`;
  const name = t.indicator_id ? (names.get(t.indicator_id) ?? t.indicator_id) : null;
  if (t.type === 'new_release' && name) return `New ${name} release`;
  const words = t.type.replace(/_/g, ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}${name ? `: ${name}` : ''}`;
}

/**
 * "What's driving this" (SPEC_MACRO §6.1): after a high-priority release or an FOMC decision the
 * release investigator runs an agent loop over the data (series, components, percentiles, prior
 * cycles, FOMC context) and writes a short, number-guarded analysis. Cited series are attached by
 * code: only series a tool actually returned.
 */
export function WhatsDriving({
  investigation,
  indicators,
}: {
  investigation: MacroInvestigation | null | undefined;
  indicators: IndicatorLite[];
}) {
  if (!investigation) return null;
  const inv = investigation;
  const byId = new Map(indicators.map((i) => [i.id, i]));
  const names = new Map(indicators.map((i) => [i.id, i.name]));
  const loop = inv.loop;
  return (
    <section aria-labelledby="driving-title" className="card p-4 md:p-5" data-testid="whats-driving">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Search className="h-4 w-4 text-accent" aria-hidden />
        <h2 id="driving-title" className="section-title">
          What&apos;s driving this
        </h2>
        <span className="chip" data-testid="driving-trigger">
          Trigger: {triggerLabel(inv.trigger, names)}
        </span>
        {inv.reused_from_run_id && (
          <span className="chip" title={`From run ${inv.reused_from_run_id}`}>
            No new trigger · from an earlier run
          </span>
        )}
      </div>
      <p className="mb-3 max-w-3xl text-sm text-muted">
        After a major release or an FOMC decision, an agent loop looks through the data (series, components,
        history, prior cycles) and explains the move. Every number it writes must come from a tool output.
      </p>
      <p className="max-w-4xl leading-relaxed">
        <InlineText text={inv.analysis} />
      </p>
      {inv.cited_series.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Series it used</p>
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="cited-series">
            {inv.cited_series.map((c) => {
              const ind = byId.get(c.id);
              return (
                <li key={c.id}>
                  <a className="chip hover:border-accent" href={c.url}>
                    <span className="font-medium text-text">{c.name}</span>
                    {ind && (
                      <span className="num text-muted">
                        {fmtValue(ind.primary.value, ind.primary.format)} {ind.primary.label}
                      </span>
                    )}
                    <span className="text-muted">FRED {c.fred_series}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="mt-4 space-y-2">
        {loop && (
          <>
            <ToolTrail
              trail={loop.tool_calls.map((tool) => ({ tool }))}
              label={`Tool calls, ${STOP_TEXT[loop.stop_reason] ?? loop.stop_reason}`}
            />
            {loop.guard_attempts > 1 && (
              <p className="text-xs text-muted">
                The number guard sent the first draft back ({loop.guard_attempts} attempts).
              </p>
            )}
          </>
        )}
        <LoopMeta
          info={{
            model: inv.model,
            generated_at: inv.generated_at,
            narrative_source: inv.narrative_source,
            steps: loop?.steps,
            tool_calls: loop ? loop.tool_calls.length : null,
            cost_usd: loop?.cost_usd,
          }}
        />
        {!loop && <p className="text-xs text-muted">No agent loop ran this time (deterministic template).</p>}
      </div>
    </section>
  );
}
