import { REPO_URL } from '@/lib/data/url';
import { formatDateTime } from '@/lib/format';

const ATTRIBUTION = [
  ['Redfin', 'https://www.redfin.com/news/data-center/'],
  ['Zillow', 'https://www.zillow.com/research/data/'],
  ['FRED', 'https://fred.stlouisfed.org/'],
  ['BLS', 'https://www.bls.gov/'],
  ['U.S. Census Bureau', 'https://www.census.gov/'],
  ['Federal Reserve Board', 'https://www.federalreserve.gov/'],
  ['SAM.gov', 'https://sam.gov/'],
  ['Grants.gov', 'https://www.grants.gov/'],
  ['GitHub', 'https://github.com/'],
] as const;

export function Footer() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev';
  const built = process.env.NEXT_PUBLIC_BUILD_TIME;
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="container-page grid gap-6 py-8 text-sm text-muted md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <p>
            Data updates automatically via{' '}
            <a className="link" href={`${REPO_URL}/actions`}>
              GitHub Actions
            </a>
            .
          </p>
          <p>
            Data:{' '}
            {ATTRIBUTION.map(([name, url], i) => (
              <span key={name}>
                <a className="link" href={url}>
                  {name}
                </a>
                {i < ATTRIBUTION.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
          <p>
            Not financial, legal, or investment advice. AI-generated summaries may contain errors; verify with
            the linked sources.
          </p>
        </div>
        <p className="num text-xs md:text-right">
          Built {built ? formatDateTime(built) : '—'}
          <br />
          Commit{' '}
          {sha === 'dev' ? (
            'dev'
          ) : (
            <a className="link" href={`${REPO_URL}/commit/${sha}`}>
              {sha}
            </a>
          )}
        </p>
      </div>
    </footer>
  );
}
