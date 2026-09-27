import type { Metadata } from 'next';
import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { getCaseStudies, getManifest } from '@/lib/data/server';
import { canonical, ogImages } from '@/lib/data/url';
import { CaseStudyMarkdown } from '@/components/case-studies/CaseStudyMarkdown';

export function generateMetadata(): Metadata {
  const title = 'Case studies';
  const description =
    'How the four agents handled real runs: what triggered them, which tools they called, what the guardrails caught and what changed afterwards.';
  return {
    title,
    description,
    alternates: { canonical: canonical('/case-studies/') },
    ...ogImages('case-studies', title, description),
  };
}

export default function CaseStudiesPage() {
  const items = getCaseStudies();
  const routes = Object.fromEntries(getManifest().agents.map((a) => [a.id, a.route]));
  return (
    <div className="space-y-10 pb-4">
      <header className="space-y-3 pb-2 pt-8">
        <h1 className="text-2xl font-bold md:text-3xl">Case studies</h1>
        <p className="max-w-3xl text-muted">
          Write-ups of individual runs, kept by each agent repo in <code>docs/case-studies.md</code>: what
          triggered the agent, which tools it called, what the guardrails caught and what changed afterwards.
        </p>
        <nav aria-label="Case studies by agent">
          <ul className="flex flex-wrap gap-2">
            {items.map((c) => (
              <li key={c.id}>
                <a href={`#cs-${c.id}`} className="chip hover:border-accent">
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {items.map((c) => (
        <section
          key={c.id}
          id={`cs-${c.id}`}
          aria-labelledby={`cs-h-${c.id}`}
          className="card scroll-mt-20 p-4 md:p-6"
          data-testid="case-study"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 id={`cs-h-${c.id}`} className="text-xl font-bold">
              {c.name}
            </h2>
            {c.sample && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral/60 bg-surface-2 px-2 py-0.5 text-xs font-semibold text-neutral"
                title={`${c.repo} has no docs/case-studies.md on main yet; showing a sample write-up.`}
                data-testid="sample-badge"
              >
                <FlaskConical className="h-3 w-3" aria-hidden /> Sample write-up
              </span>
            )}
          </div>
          <p className="mb-4 flex flex-wrap gap-x-3 text-sm text-muted">
            <a className="link" href={c.source_url}>
              {c.repo}/docs/case-studies.md
            </a>
            {routes[c.id] && (
              <Link className="link" href={`${routes[c.id].replace(/\/$/, '')}/`}>
                Latest data
              </Link>
            )}
          </p>
          {/* The file's own top-level title ("# Case studies") is replaced by the section heading. */}
          <CaseStudyMarkdown markdown={c.markdown.replace(/^\s*#\s[^\n]*\n/, '')} repo={c.repo} />
        </section>
      ))}
    </div>
  );
}
