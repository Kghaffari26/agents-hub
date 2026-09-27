import { CheckCircle2, CircleSlash, Landmark } from 'lucide-react';
import type { GrantsResearch } from '@/lib/schemas/agentic';
import { currency, formatDate } from '@/lib/format';
import { CitationList, InlineText, LoopMeta, ToolTrail } from '../agentic/LoopParts';

const STOP_TEXT: Record<string, string> = {
  max_steps: 'stopped at its step budget',
  max_usd: 'stopped at its cost budget',
  max_seconds: 'stopped at its time budget',
  run_budget: 'stopped at the run budget',
  end_turn_without_finish: 'ended without a result',
  refusal: 'model refused',
};

/**
 * Bid research (SPEC_GRANTS §6.3): sam-agent's research loop reads the notice, its attachments
 * and USAspending prior awards, then writes a go/no-go brief. Prior awards are copied from
 * USAspending in code. Collapsed inside the match card; hook-free (renders inside the client
 * MatchCard).
 */
export function BidResearch({ research, title }: { research: GrantsResearch; title: string }) {
  const r = research;
  const go = r.go_no_go === 'go';
  const usaspending = r.citations.filter((c) => /usaspending\.gov/i.test(c.url));
  const other = r.citations.filter((c) => !/usaspending\.gov/i.test(c.url));
  return (
    <details
      className="group rounded-md border border-border bg-surface-2/60 text-sm"
      data-testid="bid-research"
    >
      <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 px-3 py-2 font-medium">
        <Landmark className="h-4 w-4 text-accent" aria-hidden />
        Bid research
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold ${go ? 'text-good' : 'text-bad'}`}
        >
          {go ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <CircleSlash className="h-3.5 w-3.5" aria-hidden />
          )}
          {go ? 'Go' : 'No-go'}
        </span>
        <span className="text-xs font-normal text-muted">
          {r.likely_incumbent ? `likely incumbent: ${r.likely_incumbent}` : 'no incumbent identified'} ·{' '}
          {r.prior_awards.length} prior award{r.prior_awards.length === 1 ? '' : 's'}
        </span>
        <span className="sr-only"> for {title}</span>
      </summary>
      <div className="space-y-3 border-t border-border p-3">
        {r.status === 'partial' && (
          <p className="rounded-md border border-dashed border-neutral/60 p-2 text-xs text-neutral">
            Partial research: the loop{' '}
            {STOP_TEXT[r.stop_reason ?? ''] ?? `stopped (${r.stop_reason ?? 'unknown'})`}.
          </p>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">What they&apos;re buying</p>
          <p className="mt-0.5 leading-relaxed">
            <InlineText text={r.what_theyre_buying} />
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {go ? 'Why go' : 'Why no-go'}
          </p>
          <p className="mt-0.5 leading-relaxed">
            <InlineText text={r.rationale} />
          </p>
        </div>
        {r.evaluation_criteria.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Evaluation criteria</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {r.evaluation_criteria.map((c) => (
                <li key={c} className="chip">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(r.likely_incumbent || r.incumbent_notes) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Incumbent</p>
            <p className="mt-0.5">
              {r.likely_incumbent && !r.incumbent_notes?.includes(r.likely_incumbent) && (
                <strong>{r.likely_incumbent}. </strong>
              )}
              {r.incumbent_notes && <InlineText text={r.incumbent_notes} />}
            </p>
          </div>
        )}
        {r.prior_awards.length > 0 && (
          <div className="table-wrap">
            <table className="data-table text-xs">
              <caption className="mb-1 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                Prior awards (USAspending)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Recipient</th>
                  <th scope="col" className="text-right">
                    Amount
                  </th>
                  <th scope="col">Period</th>
                </tr>
              </thead>
              <tbody>
                {r.prior_awards.map((a) => (
                  <tr key={a.award_id}>
                    <th scope="row" className="!normal-case !tracking-normal text-left font-medium text-text">
                      <a className="link" href={a.url}>
                        {a.recipient ?? a.award_id}
                      </a>
                      <span className="block font-mono text-[11px] font-normal text-muted">{a.award_id}</span>
                    </th>
                    <td className="num text-right">{currency(a.amount ?? null)}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(a.start_date ?? null)} – {formatDate(a.end_date ?? null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {r.risks.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Risks</p>
            <ul className="mt-1 list-disc pl-5">
              {r.risks.map((q) => (
                <li key={q}>
                  <InlineText text={q} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <CitationList citations={usaspending} title="USAspending citations" testId="usaspending-citations" />
        <CitationList citations={other} title="Other sources read" />
        <ToolTrail trail={r.tools_used.map((tool) => ({ tool }))} label="Tools the agent used" />
        <LoopMeta
          info={{
            model: r.model,
            generated_at: r.researched_at,
            narrative_source: r.narrative_source,
            steps: r.steps,
            tool_calls: r.tools_used.length,
            cost_usd: r.cost_usd,
          }}
        />
      </div>
    </details>
  );
}
