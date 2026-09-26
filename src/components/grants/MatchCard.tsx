'use client';

import { useId, useState } from 'react';
import { AlertTriangle, Clock, ExternalLink, Sparkles } from 'lucide-react';
import type { TopMatch } from '@/lib/schemas/grants';
import { currency, formatDate } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { FitMeter } from './FitMeter';
import { RecommendationBadge, SourceBadge } from './badges';
import { daysLeft, formatAgency, sourceLabel } from './grantsFilters';

const VALUE_KIND_LABEL: Record<string, string> = {
  award_ceiling: 'Award ceiling',
  ceiling: 'Award ceiling',
  estimate: 'Estimated value',
  estimated: 'Estimated value',
};

export function valueText(v: TopMatch['value']): { label: string; text: string } {
  const label = VALUE_KIND_LABEL[v.kind] ?? 'Value';
  if (v.amount == null) return { label: 'Value', text: 'Not disclosed' };
  const floor = v.floor != null && v.floor > 0 ? ` (floor ${currency(v.floor)})` : '';
  return { label, text: `${currency(v.amount)}${floor}` };
}

export function countdownText(d: number | null): string {
  if (d == null) return 'No deadline listed';
  if (d < 0) return 'Closed';
  if (d === 0) return 'Closes today';
  if (d === 1) return 'Closes tomorrow';
  return `Closes in ${d} days`;
}

/** Deadline + client-side countdown; red with an icon under 7 days. */
export function Deadline({ deadline }: { deadline: string | null }) {
  const now = useNow();
  const d = daysLeft(deadline, now);
  const urgent = d != null && d < 7;
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-1.5 ${urgent ? 'font-semibold text-bad' : ''}`}
    >
      {urgent ? (
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      )}
      <span>{countdownText(d)}</span>
      {deadline && (
        <time dateTime={deadline} className={urgent ? '' : 'text-muted'}>
          · {formatDate(deadline)}
        </time>
      )}
    </span>
  );
}

export function MatchCard({ match, rank }: { match: TopMatch; rank?: number }) {
  const [open, setOpen] = useState(false);
  const summaryId = useId();
  const titleId = useId();
  const value = valueText(match.value);
  const s = match.summary;
  const isTemplate = s?.narrative_source === 'template';

  return (
    <article
      id={`match-${match.id}`}
      data-testid="match-card"
      aria-labelledby={titleId}
      className="card flex scroll-mt-20 flex-col gap-4 p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        {rank != null && <span className="num text-xs font-semibold text-muted">#{rank}</span>}
        <RecommendationBadge rec={match.recommendation} />
        {match.is_new && <span className="chip border-accent font-semibold text-accent">NEW</span>}
        {match.changed && <span className="chip">Updated</span>}
        <SourceBadge source={match.source} />
        <span className="chip">{match.notice_type_label}</span>
      </div>

      <div className="min-w-0">
        <h3 id={titleId} className="text-base font-semibold leading-snug">
          {match.title}
        </h3>
        <p className="mt-0.5 text-sm text-muted">
          {formatAgency(match.agency)}
          {match.office && <span className="break-words"> · {match.office}</span>}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">Deadline</dt>
          <dd>
            <Deadline deadline={match.deadline} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{value.label}</dt>
          <dd className={`num ${match.value.amount == null ? 'text-muted' : 'font-semibold'}`}>
            {value.text}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Set-aside</dt>
          <dd>{match.set_aside_label ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">NAICS · Posted</dt>
          <dd className="num">
            {match.naics.length ? match.naics.join(', ') : '—'} · {formatDate(match.posted_date)}
          </dd>
        </div>
      </dl>

      <FitMeter fit={match.fit} subScores={match.sub_scores} />

      {match.reasons.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Why it matches</p>
          <ul className="flex flex-wrap gap-1.5">
            {match.reasons.map((r) => (
              <li key={r} className="chip">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {match.red_flags.length > 0 && (
        <div className="rounded-md border border-[color-mix(in_srgb,var(--bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] p-2.5 text-sm">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-4 w-4 text-bad" aria-hidden />
            Red flags
          </p>
          <ul className="mt-1 list-disc pl-5">
            {match.red_flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {s ? (
        <div className="border-t border-border pt-3 text-sm">
          <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="chip">
              <Sparkles className="h-3 w-3 text-accent" aria-hidden />
              {isTemplate ? 'Template summary' : 'AI-generated summary'}
            </span>
            {s.model && !isTemplate && <span>{s.model}</span>}
          </p>
          <div id={summaryId} className={open ? '' : 'line-clamp-2'}>
            <p className="leading-relaxed">{s.what_they_want}</p>
            {s.why_fit.length > 0 && (
              <ul className="mt-1 list-disc pl-5 leading-relaxed">
                {s.why_fit.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            className="link mt-1 text-sm"
            aria-expanded={open}
            aria-controls={summaryId}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Show less' : 'Show full summary'}
          </button>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Risks</h4>
              {s.risks.length ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {s.risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted">None noted</p>
              )}
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Next steps</h4>
              {s.next_steps.length ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {s.next_steps.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted">—</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted">No summary for this item yet.</p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-xs text-muted">
          Confidence: {match.confidence}
          {match.solicitation_number && <> · {match.solicitation_number}</>}
        </span>
        <a href={match.url} className="btn" target="_blank" rel="noopener noreferrer">
          View on {sourceLabel(match.source)}
          <span className="sr-only">: {match.title} (opens in a new tab)</span>
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      </div>
    </article>
  );
}
