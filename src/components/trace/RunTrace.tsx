import { Activity } from 'lucide-react';
import type { ManifestAgent } from '@/lib/schemas/manifest';
import type { TraceInfo } from '@/lib/data/server';
import { count, duration, usdPrecise } from '@/lib/format';
import { SampleBadge } from '../common/SampleBadge';
import { TraceTimeline } from './TraceTimeline';

/**
 * "Run trace" panel on each agent page: the latest run's roll-up (from trace.json, else the
 * manifest's `trace_summary`) and, collapsed, every span as a timeline or a text table.
 */
export function RunTrace({ agent, info }: { agent: ManifestAgent; info: TraceInfo | null }) {
  const summary = info?.summary ?? agent.trace_summary ?? null;
  const stats: [string, string, string][] = summary
    ? [
        ['LLM calls', count(summary.llm_calls), 'Model requests, including agent-loop turns'],
        ['Tool calls', count(summary.tool_calls), 'Tools the agent loop invoked'],
        ['Loop steps', count(summary.steps), 'Agent-loop model turns'],
        ['Guard retries', count(summary.guard_retries), 'Narratives the number guard sent back once'],
        ['LLM cost', usdPrecise(summary.cost_usd), 'Sum of every LLM call this run'],
        ['Latency', duration(summary.total_latency_ms), 'Wall time of the traced run'],
      ]
    : [];
  return (
    <section aria-labelledby={`trace-${agent.id}`} className="card p-4 md:p-5" data-testid="run-trace">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Activity className="h-4 w-4 text-accent" aria-hidden />
        <h2 id={`trace-${agent.id}`} className="section-title">
          Run trace
        </h2>
        {agent.sample && <SampleBadge repo={agent.repo} />}
        {info && <span className="text-xs text-muted">run {info.runId}</span>}
      </div>
      {summary ? (
        <>
          <p className="mb-3 max-w-3xl text-sm text-muted">
            Every model call, tool call, HTTP request and number-guard check of the latest run, recorded by
            agents-core with secrets redacted. Costs are what the API billed.
          </p>
          <dl
            className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6"
            data-testid="trace-summary"
          >
            {stats.map(([k, v, hint]) => (
              <div key={k} title={hint}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="num text-lg font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {info ? (
            <TraceTimeline path={info.path} spanCount={info.spans} />
          ) : (
            <p className="mt-3 text-sm text-muted">
              The span-level trace file wasn&apos;t published for this run.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">
          No trace yet. Agents on agents-core v0.3.0 or later publish <code>trace.json</code> after every run;
          this panel fills in on the first one.
        </p>
      )}
    </section>
  );
}
