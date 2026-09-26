import { ExternalLink, Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { NextMeeting } from './NextMeeting';
import { StatementDiff } from './StatementDiff';
import { DECISION_WORD, TONE_LABEL, bpChange, targetRange, type MacroFomc } from './helpers';

const TONE_ICON = { more_hawkish: '▲', unchanged: '■', more_dovish: '▼' } as const;

/** Latest FOMC decision, AI read with tone shift, statement diff and minutes (SPEC_WEBSITE §7.3 item 6). */
export function FomcPanel({ fomc }: { fomc: MacroFomc }) {
  const l = fomc.latest;
  return (
    <section aria-labelledby="fomc-title" className="card space-y-6 p-4 md:p-5" data-testid="fomc-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fomc-title" className="section-title">
          The Fed
        </h2>
        <NextMeeting meeting={fomc.next_meeting} />
      </div>

      {!l ? (
        <p className="text-sm text-muted">No FOMC statement has been processed yet.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-card bg-surface-2 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Target range</p>
              <p className="num text-xl font-semibold">{targetRange(l.target_range)}</p>
            </div>
            <div className="rounded-card bg-surface-2 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Decision</p>
              <p className="num text-xl font-semibold">
                {DECISION_WORD[l.decision]}{' '}
                <span className="text-base font-medium text-muted">· {bpChange(l.change_bp)}</span>
              </p>
            </div>
            <div className="rounded-card bg-surface-2 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Vote</p>
              <p className="num text-xl font-semibold">
                {l.votes.for_count}–{l.votes.against.length}
              </p>
              {l.votes.against.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-muted">
                  {l.votes.against.map((a) => (
                    <li key={a.name}>
                      Dissent: <span className="text-text">{a.name}</span>
                      {a.preferred && <> (preferred {a.preferred})</>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-card bg-surface-2 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Meeting</p>
              <p className="text-base font-semibold">{formatDate(l.date)}</p>
              <a
                href={l.url}
                className="link inline-flex items-center gap-0.5 text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Statement
                <ExternalLink className="h-3 w-3" aria-hidden />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </div>

          {l.read && (
            <div className="relative space-y-3 overflow-hidden rounded-card border border-border p-4">
              <div className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden />
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">Plain-English read</h3>
                <span className="chip">
                  <Sparkles className="h-3 w-3 text-accent" aria-hidden />
                  {l.read.narrative_source === 'template' ? 'Template summary' : 'AI-generated'}
                </span>
                <span className="chip border-accent font-semibold" data-testid="tone-shift">
                  <span aria-hidden>{TONE_ICON[l.read.tone_shift]}</span> Tone:{' '}
                  {TONE_LABEL[l.read.tone_shift]}
                </span>
              </div>
              <p className="leading-relaxed">{l.read.summary}</p>
              <p className="text-sm text-muted">
                <span className="font-semibold text-text">
                  Why {TONE_LABEL[l.read.tone_shift].toLowerCase()}:{' '}
                </span>
                {l.read.rationale}
              </p>
              {l.read.key_phrases.length > 0 && (
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Key phrases</h4>
                  <ul className="space-y-1 text-sm">
                    {l.read.key_phrases.map((k) => (
                      <li key={k.phrase}>
                        <q className="font-medium">{k.phrase}</q>{' '}
                        <span className="text-muted">— {k.interpretation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <StatementDiff
            previousText={l.previous_text}
            latestText={l.latest_text}
            previousDate={l.previous_date}
            latestDate={l.date}
            changes={l.changes}
            citedChangeIdx={l.read?.cited_change_idx ?? []}
          />
        </>
      )}

      {fomc.minutes && (
        <div className="space-y-1 border-t border-border pt-4">
          <h3 className="text-base font-semibold">Minutes</h3>
          <p className="text-sm">
            <a href={fomc.minutes.url} className="link" target="_blank" rel="noopener noreferrer">
              Minutes of the {formatDate(fomc.minutes.meeting_date)} meeting
              <span className="sr-only"> (opens in a new tab)</span>
            </a>{' '}
            <span className="text-muted">· released {formatDate(fomc.minutes.released_at)}</span>
          </p>
          {fomc.minutes.summary && (
            <p className="text-sm leading-relaxed">
              {fomc.minutes.summary}
              {fomc.minutes.narrative_source && (
                <span className="ml-1 text-xs text-muted">
                  ({fomc.minutes.narrative_source === 'llm' ? 'AI summary' : 'template summary'})
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
