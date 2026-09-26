import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { Sparkles, FileText } from 'lucide-react';
import type { Repo } from '@/lib/schemas/repoMaint';
import { DASH, formatDate } from '@/lib/format';
import { CopyButton } from './CopyButton';
import { shortName } from './labels';

type Changelog = NonNullable<Repo['changelog']>;

/**
 * The draft sits under an h3 card heading, so shift Markdown headings down to h4–h6
 * to keep the page outline valid.
 */
const components: Components = {
  h1: ({ children }) => <h4 className="mt-4 text-base font-semibold first:mt-0">{children}</h4>,
  h2: ({ children }) => <h4 className="mt-4 text-base font-semibold first:mt-0">{children}</h4>,
  h3: ({ children }) => (
    <h5 className="mt-3 text-sm font-semibold uppercase tracking-wide text-muted">{children}</h5>
  ),
  h4: ({ children }) => <h6 className="mt-3 text-sm font-semibold">{children}</h6>,
  h5: ({ children }) => <h6 className="mt-3 text-sm font-semibold">{children}</h6>,
  h6: ({ children }) => <h6 className="mt-3 text-sm font-semibold">{children}</h6>,
  a: ({ children, href }) => (
    <a href={href} className="link" rel="nofollow noopener noreferrer">
      {children}
    </a>
  ),
  // Never render images from agent output.
  img: ({ alt }) => <span>{alt ?? ''}</span>,
};

function sinceNote(cl: Changelog): string {
  const date = cl.base_date ? formatDate(cl.base_date) : null;
  if (cl.base_ref) return `since ${cl.base_ref}${date ? ` · ${date}` : ''}`;
  return date ? `since ${date}` : 'last 30 days';
}

/** One repo's latest changelog draft, rendered as sanitized Markdown with no raw HTML. */
export function ChangelogDraft({ repoName, changelog }: { repoName: string; changelog: Changelog }) {
  const cl = changelog;
  const headingId = `changelog-${repoName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const isAi = cl.narrative_source === 'llm';
  const unit = cl.source === 'pull_requests' ? 'pull request' : 'commit';
  return (
    <article
      className="card flex min-w-0 flex-col gap-3 p-4 md:p-5"
      data-testid="changelog-draft"
      aria-labelledby={headingId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={headingId} className="break-words text-base font-semibold">
            {repoName}
          </h3>
          <p className="text-sm text-muted">{sinceNote(cl)}</p>
        </div>
        <CopyButton
          text={cl.markdown}
          label="Copy Markdown"
          srContext={`changelog for ${shortName(repoName)}`}
        />
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <div className="flex gap-1">
          <dt>Suggested version:</dt>
          <dd className="num font-semibold text-text">{cl.suggested_version ?? DASH}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Built from:</dt>
          <dd className="num">
            {cl.item_count} {unit}
            {cl.item_count === 1 ? '' : 's'}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="sr-only">Written by:</dt>
          <dd className="inline-flex items-center gap-1">
            {isAi ? (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <FileText className="h-3.5 w-3.5" aria-hidden />
            )}
            {isAi ? `AI-drafted${cl.model ? ` · ${cl.model}` : ''}` : 'Template (no AI)'}
          </dd>
        </div>
        {cl.cached && (
          <div className="flex gap-1">
            <dt className="sr-only">Cache:</dt>
            <dd>Cached: no new changes since the last draft</dd>
          </div>
        )}
      </dl>
      <div className="rounded-md border border-border bg-surface-2 p-3 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-surface [&_code]:px-1 [&_code]:text-[13px] [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 break-words">
        <ReactMarkdown skipHtml rehypePlugins={[rehypeSanitize]} components={components}>
          {cl.markdown}
        </ReactMarkdown>
      </div>
    </article>
  );
}
