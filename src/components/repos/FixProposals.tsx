import { CircleAlert, GitPullRequestDraft, UserCheck } from 'lucide-react';
import type { FixProposal } from '@/lib/schemas/agentic';
import { InlineText, LoopMeta, ToolTrail } from '../agentic/LoopParts';
import { DiffPreview } from './DiffPreview';
import { diffFiles, parseDiff } from './diff';
import { shortName } from './labels';

/** SPEC_REPO_MAINT §6.1 statuses → the card's badge. */
export function statusLabel(p: Pick<FixProposal, 'status' | 'pr_url'>): { text: string; awaiting: boolean } {
  switch (p.status) {
    case 'proposed':
      return { text: 'Draft PR — awaiting human review', awaiting: true };
    case 'pr_opened':
      return { text: 'Draft PR opened — awaiting human review', awaiting: true };
    case 'no_fix':
      return { text: 'No small, safe fix found', awaiting: false };
    case 'stopped':
      return { text: 'Fix loop stopped', awaiting: false };
    case 'approval_blocked':
      return { text: 'Approved, but a write gate blocked it', awaiting: false };
    case 'failed':
      return { text: 'Approved, but the PR could not be opened', awaiting: false };
    default: {
      const words = p.status.replace(/_/g, ' ');
      return { text: words.charAt(0).toUpperCase() + words.slice(1), awaiting: false };
    }
  }
}

export interface RepoFix {
  repo: string;
  proposal: FixProposal;
}

/**
 * Fix proposals (SPEC_REPO_MAINT §6.1): for small, well-specified bugs in sandbox repos the
 * agent drafts a patch with a read-only tool loop and validates that it applies. A PR is only
 * opened after a maintainer approves the proposal id; the agent never merges.
 */
export function FixProposals({ items }: { items: RepoFix[] }) {
  if (!items.length) return <p className="text-sm text-muted">No fix proposals this run.</p>;
  return (
    <div className="grid gap-4 xl:grid-cols-2" data-testid="fix-proposals">
      {items.map(({ repo, proposal: p }) => {
        const st = statusLabel(p);
        const files = p.files_changed.length
          ? p.files_changed
          : p.diff
            ? diffFiles(parseDiff(p.diff)).map((f) => f.path)
            : [];
        const key = `${repo}-${p.id}`;
        return (
          <article
            key={key}
            className="card flex min-w-0 flex-col gap-3 p-4"
            aria-labelledby={`fix-${key}`}
            data-testid="fix-proposal"
          >
            <p
              className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                st.awaiting ? 'border-neutral/60 bg-surface-2 text-neutral' : 'border-border text-muted'
              }`}
              data-testid="fix-status"
            >
              {st.awaiting ? (
                <UserCheck className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <CircleAlert className="h-3.5 w-3.5" aria-hidden />
              )}
              {st.text}
            </p>
            <div className="min-w-0">
              <h3 id={`fix-${key}`} className="font-semibold leading-snug">
                <GitPullRequestDraft className="mr-1 inline h-4 w-4 text-muted" aria-hidden />
                Fix for #{p.issue_number}
                {p.issue_title && `: ${p.issue_title}`}
              </h3>
              <p className="mt-0.5 text-sm text-muted">
                {shortName(repo)}
                {p.issue_url && (
                  <>
                    {' · '}
                    <a className="link" href={p.issue_url}>
                      issue #{p.issue_number}
                    </a>
                  </>
                )}
                {' · '}proposal <code className="font-mono text-xs">{p.id}</code>
              </p>
            </div>
            {p.summary && (
              <p className="text-sm leading-relaxed">
                <InlineText text={p.summary} />
              </p>
            )}
            {p.rationale && (
              <p className="text-sm leading-relaxed text-muted">
                <span className="font-medium text-text">Why: </span>
                <InlineText text={p.rationale} />
              </p>
            )}
            {p.reason && (
              <p className="text-sm">
                <span className="font-medium">Reason: </span>
                {p.reason}
              </p>
            )}
            {p.diff && (
              <>
                <p className="text-sm">
                  <span className="num">
                    {files.length} file{files.length === 1 ? '' : 's'},{' '}
                    <span className="text-good">+{p.lines_added}</span>{' '}
                    <span className="text-bad">−{p.lines_removed}</span>
                  </span>
                  <span className="sr-only">
                    {' '}
                    ({p.lines_added} lines added, {p.lines_removed} removed)
                  </span>
                  {files.length > 0 && (
                    <span className="ml-2 break-all font-mono text-xs text-muted">{files.join(', ')}</span>
                  )}
                </p>
                <DiffPreview diff={p.diff} label={`Proposed diff for issue #${p.issue_number}`} />
              </>
            )}
            {p.pr_url ? (
              <a className="link text-sm" href={p.pr_url}>
                View the draft pull request
              </a>
            ) : (
              st.awaiting && (
                <p className="text-xs text-muted">
                  To open it as a draft PR, a maintainer approves proposal{' '}
                  <code className="font-mono">{p.id}</code> in the agent&apos;s workflow (apply mode).
                </p>
              )
            )}
            {p.loop && (
              <ToolTrail trail={p.loop.tools_called.map((tool) => ({ tool }))} label="Tools the agent used" />
            )}
            <LoopMeta
              className="mt-auto"
              info={{
                model: p.model,
                generated_at: p.proposed_at,
                narrative_source: p.narrative_source,
                steps: p.loop?.steps,
                tool_calls: p.loop ? p.loop.tools_called.length : null,
                cost_usd: p.loop?.usd,
              }}
            />
          </article>
        );
      })}
    </div>
  );
}
