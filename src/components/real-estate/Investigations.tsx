import Link from 'next/link';
import { Search } from 'lucide-react';
import type { Investigation, InvestigationSummary } from '@/lib/schemas/agentic';
import type { MetricRegistryEntry, MetroSummary } from '@/lib/schemas/realEstate';
import { changeFormat, isRatioMetric, resolveRegistry, yoyOf } from '@/lib/metrics';
import { formatDelta, formatValue } from '@/lib/format';
import { InlineText, LoopMeta, ToolTrail } from '../agentic/LoopParts';

const TRIGGER: Record<string, string> = { new_major_flag: 'New major flag', top_mover: 'Top mover' };

const STOP_TEXT: Record<string, string> = {
  finished: 'finished',
  not_run: 'no loop ran (template)',
  max_steps: 'stopped at its step budget',
  max_usd: 'stopped at its cost budget',
  max_seconds: 'stopped at its time budget',
  run_budget: 'stopped at the run budget',
  guard_failed: 'failed the number guard (template)',
};

/** Chips for the metrics an investigation cites, with the metro's current value and YoY. */
function CitedMetrics({
  keys,
  metro,
  registry,
}: {
  keys: string[];
  metro: MetroSummary | undefined;
  registry: ReturnType<typeof resolveRegistry>;
}) {
  if (!keys.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Metrics it cites" data-testid="cited-metrics">
      {keys.map((k) => {
        const m = registry.find((r) => r.key === k);
        const v = metro?.latest[k];
        const opts = { isRatio: isRatioMetric(m) };
        const yoy = yoyOf(v);
        return (
          <li key={k} className="chip">
            <span className="font-medium text-text">{m?.label ?? k.replace(/_/g, ' ')}</span>
            {m && v?.value != null && <span className="num">{formatValue(v.value, m.format, opts)}</span>}
            {m && yoy != null && (
              <span className="num text-muted">{formatDelta(yoy, changeFormat(m), opts)} YoY</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Metro investigations (SPEC_REAL_ESTATE §6.3): each run the investigator explains why up to 3
 * metros are moving (new major flags, else the top mover) with a budgeted tool loop. The index
 * carries a summary per metro; the focused metro's page shows the full explanation.
 */
export function Investigations({
  items,
  metros,
  registry,
  focusSlug,
  focus,
}: {
  items: InvestigationSummary[] | undefined;
  metros: MetroSummary[];
  registry: MetricRegistryEntry[];
  focusSlug?: string;
  focus?: Investigation | null;
}) {
  const list = items ?? [];
  if (!list.length && !focus) return null;
  const resolved = resolveRegistry(registry);
  const bySlug = new Map(metros.map((m) => [m.slug, m]));
  const others = list.filter((i) => i.slug !== focus?.slug);
  const stop = (r: string) => STOP_TEXT[r] ?? r.replace(/_/g, ' ');
  return (
    <section aria-labelledby="investigations-title" data-testid="investigations">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Search className="h-4 w-4 text-accent" aria-hidden />
        <h2 id="investigations-title" className="section-title">
          Metro investigations
        </h2>
      </div>
      <p className="mb-3 max-w-3xl text-sm text-muted">
        Each run the agent picks up to three metros that are moving (a new major flag, else the biggest price
        mover) and investigates why with a small tool budget: the metro&apos;s series, its regional peers, the
        national picture and similar past episodes. Every number it writes must come from a tool output.
      </p>
      {focus && (
        <article
          className="card mb-4 space-y-3 p-4 ring-2 ring-accent md:p-5"
          aria-labelledby="inv-focus"
          data-testid="investigation-focus"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="inv-focus" className="font-semibold">
              Why {focus.name} is moving
            </h3>
            <span className="chip">
              {TRIGGER[focus.trigger] ?? focus.trigger}: {focus.trigger_label}
            </span>
            {focus.reused && <span className="chip">No new data · reused</span>}
          </div>
          <p className="max-w-4xl leading-relaxed">
            <InlineText text={focus.explanation} />
          </p>
          <CitedMetrics keys={focus.cited_metrics} metro={bySlug.get(focus.slug)} registry={resolved} />
          <ToolTrail
            trail={focus.tools_called.map((tool) => ({ tool }))}
            label={`Tool calls, ${stop(focus.stop_reason)}`}
          />
          <LoopMeta
            info={{
              model: focus.model,
              generated_at: focus.generated_at,
              narrative_source: focus.narrative_source,
              steps: focus.steps,
              tool_calls: focus.tools_called.length,
              cost_usd: focus.cost_usd,
            }}
          />
        </article>
      )}
      {others.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {others.map((inv) => (
            <article
              key={inv.slug}
              className="card flex flex-col gap-3 p-4"
              aria-labelledby={`inv-${inv.slug}`}
              data-testid="investigation-card"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 id={`inv-${inv.slug}`} className="font-semibold">
                  <Link href={`/real-estate/${inv.slug}/`} className="link">
                    {inv.name}
                  </Link>
                </h3>
                <span className="chip">
                  {TRIGGER[inv.trigger] ?? inv.trigger}: {inv.trigger_label}
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                <InlineText text={inv.summary} />
              </p>
              <CitedMetrics keys={inv.cited_metrics} metro={bySlug.get(inv.slug)} registry={resolved} />
              <p className="mt-auto flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span>{inv.narrative_source === 'template' ? 'Template text' : 'AI-generated'}</span>·
                <span>{stop(inv.stop_reason)}</span>
                {inv.slug !== focusSlug && (
                  <>
                    ·
                    <Link href={`/real-estate/${inv.slug}/`} className="link">
                      Full explanation
                    </Link>
                  </>
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
