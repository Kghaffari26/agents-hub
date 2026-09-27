import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

/**
 * Resolve a link in `<repo>/docs/case-studies.md` the way GitHub would: absolute URLs and
 * anchors pass through; relative paths point at the file on GitHub (images at the raw file).
 */
export function resolveRepoUrl(url: string, repo: string, branch = 'main', image = false): string {
  if (/^(https?:|mailto:|#)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return ''; // javascript:, data:, … are dropped
  const base = image
    ? `https://raw.githubusercontent.com/${repo}/${branch}/`
    : `https://github.com/${repo}/blob/${branch}/`;
  const clean = url.startsWith('/') ? url.slice(1) : new URL(url, 'https://x/docs/').pathname.slice(1);
  return base + clean;
}

/** Headings shift down so each agent's file nests under its h2 on the page. */
function components(repo: string): Components {
  return {
    h1: ({ children }) => <h3 className="mt-6 text-lg font-semibold first:mt-0">{children}</h3>,
    h2: ({ children }) => <h3 className="mt-6 text-lg font-semibold first:mt-0">{children}</h3>,
    h3: ({ children }) => <h4 className="mt-4 font-semibold">{children}</h4>,
    h4: ({ children }) => <h5 className="mt-3 font-semibold">{children}</h5>,
    h5: ({ children }) => <h6 className="mt-3 font-semibold">{children}</h6>,
    h6: ({ children }) => <h6 className="mt-3 font-semibold">{children}</h6>,
    a: ({ children, href }) => (
      <a href={href ? resolveRepoUrl(href, repo) : undefined} className="link" rel="noopener noreferrer">
        {children}
      </a>
    ),
    img: ({ src, alt }) =>
      typeof src === 'string' && resolveRepoUrl(src, repo, 'main', true) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveRepoUrl(src, repo, 'main', true)}
          alt={alt ?? ''}
          loading="lazy"
          className="my-3 max-w-full rounded-md border border-border"
        />
      ) : (
        <span>{alt ?? ''}</span>
      ),
    p: ({ children }) => <p className="mt-3 leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
    code: ({ children }) => (
      <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em] [overflow-wrap:anywhere]">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="mt-3 overflow-x-auto rounded-md bg-surface-2 p-3 text-sm">{children}</pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="mt-3 border-l-4 border-border pl-3 text-muted">{children}</blockquote>
    ),
    table: ({ children }) => (
      <div className="table-wrap mt-3">
        <table className="data-table">{children}</table>
      </div>
    ),
  };
}

/** One agent's case-studies.md, sanitized (no raw HTML). */
export function CaseStudyMarkdown({ markdown, repo }: { markdown: string; repo: string }) {
  return (
    <div className="max-w-3xl text-[15px]">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={components(repo)}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
