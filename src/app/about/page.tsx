import type { Metadata } from 'next';
import Link from 'next/link';
import { getCostSummary, getEvals, getManifest } from '@/lib/data/server';
import { EvalsBody, EvalsSampleNote } from '@/components/evals/EvalsSection';
import { ArchitectureDiagram } from '@/components/about/ArchitectureDiagram';
import { CostChart } from '@/components/about/CostChart';
import { AGENT_REPOS } from '@/lib/nav';
import { canonical, REPO_URL } from '@/lib/data/url';
import { ogImages } from '@/lib/data/url';
import { usd } from '@/lib/format';

export function generateMetadata(): Metadata {
  const c = getCostSummary();
  return {
    title: 'How it works',
    description: `Architecture, methods, costs (${usd(c.total_usd)} this month) and limitations of the four Agents Hub agents.`,
    alternates: { canonical: canonical('/about/') },
    ...ogImages('about'),
  };
}

const HOW: Record<string, string> = {
  real_estate:
    'Every Friday it downloads Redfin, Zillow, FRED and Census permit data for 50 metros, then computes year-over-year changes, percentile ranks, a relative market-temperature score, deterministic flags and mortgage payments in Python. Claude Haiku writes a short brief per metro and Claude Sonnet the national brief, using only those computed numbers. For flagged metros an agent loop investigates why (e.g. new listings vs homes sitting longer) with a small tool budget. The output is an index file plus one lazy-loaded file per metro.',
  macro:
    'Each weekday it pulls about 25 FRED series and the Federal Reserve’s FOMC statements, computes transforms, revisions and deterministic regime labels, and ranks “events” worth a sentence. Claude turns the top events into a cited “what changed” brief, reads each new FOMC statement against the previous one, and for notable moves runs a tool loop over component series and release text to explain what’s driving them. Headlines come from templates, not the model.',
  grants:
    'Daily it screens SAM.gov contract notices and Grants.gov opportunities against a business profile with deterministic hard filters and a relevance pre-score. Candidates are scored on a five-part rubric by Claude through the Batch API (half price), with code-enforced caps. The top 20 get a fit summary, risks and next steps, and the best matches a bid-research brief (incumbent, comparable awards, price range) from USAspending.',
  repo_maint:
    'Daily it reads GitHub issues, PRs, checks and releases for the watched repos, computes health scores, stale PRs and TF-IDF duplicate candidates, and asks Claude to classify untriaged issues and draft changelogs. It runs in read-only report mode by default; apply mode is gated per repo. For well-specified bugs it drafts a fix and runs the tests, but opening the pull request waits for a human.',
};

export default function AboutPage() {
  const costs = getCostSummary();
  const manifest = getManifest();
  const evalSources = [...manifest.agents.map((a) => a.id), 'agents_mcp'].map(getEvals);
  return (
    <div className="max-w-none space-y-10 pb-4">
      <header className="space-y-3 pb-2 pt-8">
        <h1 className="text-2xl font-bold md:text-3xl">How it works</h1>
        <p className="max-w-3xl text-muted">
          Four independent agents run on GitHub Actions schedules, publish validated JSON to their own data
          branches, and this static site assembles it into one dashboard. Numbers are computed in code; the
          model only writes narrative about them.
        </p>
      </header>

      <section aria-labelledby="arch" className="space-y-3">
        <h2 id="arch" className="section-title">
          Architecture
        </h2>
        <ArchitectureDiagram />
      </section>

      <section aria-labelledby="agents" className="space-y-3">
        <h2 id="agents" className="section-title">
          The agents
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {manifest.agents.map((a) => {
            const info = AGENT_REPOS[a.id];
            return (
              <article key={a.id} className="card space-y-2 p-4">
                <h3 className="font-semibold">{a.name}</h3>
                <p className="text-sm leading-relaxed text-muted">{HOW[a.id]}</p>
                {info && (
                  <p className="flex flex-wrap gap-x-3 text-sm">
                    <a className="link" href={`https://github.com/${info.repo}`}>
                      {info.repo}
                    </a>
                    <a className="link" href={`https://github.com/${info.repo}/blob/main/${info.spec}`}>
                      Spec
                    </a>
                  </p>
                )}
              </article>
            );
          })}
        </div>
        <p className="text-sm text-muted">
          Shared framework:{' '}
          <a className="link" href="https://github.com/Kghaffari26/agents-core">
            Kghaffari26/agents-core
          </a>{' '}
          (HTTP caching, per-run budget cap, number guard, budgeted agent loop, tracing, evals, publisher).
          The same data is available to Claude through{' '}
          <Link className="link" href="/mcp/">
            the agents-mcp server
          </Link>
          ; write-ups of individual runs are in{' '}
          <Link className="link" href="/case-studies/">
            case studies
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="costs" className="space-y-3">
        <h2 id="costs" className="section-title">
          Costs
        </h2>
        <CostChart costs={costs} />
      </section>

      <section aria-labelledby="evals" className="space-y-3">
        <h2 id="evals" className="section-title">
          Evals
        </h2>
        <p className="max-w-3xl text-sm text-muted">
          Latest scores and history from each repo&apos;s <code>evals/history.jsonl</code> (0–100%, higher is
          better), including the MCP server&apos;s tool-selection eval.
        </p>
        <div className="grid gap-4 xl:grid-cols-2" data-testid="about-evals">
          {evalSources.map(
            (e) =>
              e && (
                <article
                  key={e.id}
                  className="card min-w-0 space-y-3 p-4"
                  aria-labelledby={`about-evals-${e.id}`}
                  data-testid="evals-section"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 id={`about-evals-${e.id}`} className="font-semibold">
                      {e.name}
                    </h3>
                    {e.sample && <EvalsSampleNote data={e} />}
                    <a className="link ml-auto text-xs" href={e.source_url}>
                      history.jsonl
                    </a>
                  </div>
                  <EvalsBody data={e} chartHeight={200} />
                </article>
              ),
          )}
        </div>
      </section>

      <section aria-labelledby="eng" className="space-y-3">
        <h2 id="eng" className="section-title">
          Engineering choices
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {[
            [
              'Numbers come from code, not the model',
              'Every figure is computed in Python. A number guard rejects narrative that cites a number not among the computed facts, retries once, then falls back to a deterministic template — labeled as such on the page.',
            ],
            [
              'Evals',
              'Every agent keeps labeled eval suites (agents-core evals: exact, numeric, trajectory and LLM-judge scorers). A pull request that changes a prompt runs them and fails on a regression; scores over time are charted below.',
            ],
            [
              'Agent loops with budgets',
              'Metro and release investigations, bid research and fix proposals run as tool-use loops with step, dollar and time budgets. Tool output is treated as untrusted data, and write actions (opening a PR) need human approval.',
            ],
            [
              'Traces',
              'Every run publishes a redacted trace: each LLM call, tool call, HTTP request and guard retry with its latency and cost. Each agent page has a Run trace panel.',
            ],
            [
              'Cost caps',
              'A per-run budget (default $0.50) stops a run before it overspends. Tiered models: fast for bulk scoring, smart for briefs; the Batch API halves bulk cost.',
            ],
            [
              'Caching',
              'HTTP responses are cached with conditional requests; LLM outputs are cached by content hash, so unchanged inputs cost nothing.',
            ],
            [
              'Schema contracts',
              'Each agent publishes JSON Schema next to its data. This site validates every file with zod at build time: a corrupt file fails the build instead of shipping a broken page.',
            ],
            [
              'Static and free',
              'A Next.js static export on GitHub Pages: no server, no database, no API keys in the browser.',
            ],
          ].map(([h, b]) => (
            <li key={h} className="card p-4">
              <p className="font-semibold">{h}</p>
              <p className="mt-1 text-sm text-muted">{b}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sources" className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h2 id="sources" className="section-title">
            Data sources and licenses
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>
              <a className="link" href="https://www.redfin.com/news/data-center/">
                Redfin Data Center
              </a>{' '}
              — data: Redfin, a national real estate brokerage.
            </li>
            <li>
              <a className="link" href="https://www.zillow.com/research/data/">
                Zillow Research
              </a>{' '}
              — ZHVI and ZORI.
            </li>
            <li>
              <a className="link" href="https://fred.stlouisfed.org/">
                FRED, Federal Reserve Bank of St. Louis
              </a>
              ; series remain the property of their sources (BLS, BEA, Census, Freddie Mac, University of
              Michigan).
            </li>
            <li>
              <a className="link" href="https://www.federalreserve.gov/">
                Federal Reserve Board
              </a>{' '}
              — FOMC statements and minutes (public domain).
            </li>
            <li>
              <a className="link" href="https://sam.gov/">
                SAM.gov
              </a>{' '}
              and{' '}
              <a className="link" href="https://www.grants.gov/">
                Grants.gov
              </a>{' '}
              — U.S. government works.
            </li>
            <li>
              <a className="link" href="https://docs.github.com/en/rest">
                GitHub REST API
              </a>
              ; map tiles © OpenStreetMap contributors.
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <h2 className="section-title">Limitations and disclaimer</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>
              Source data lags: Redfin and Zillow are monthly, about a month behind; some FRED series are
              revised after release.
            </li>
            <li>The market temperature is relative to the other tracked metros, not an absolute measure.</li>
            <li>
              Grant and contract fit scores are automated screening. Always verify on the official listing
              before acting.
            </li>
            <li>AI-generated summaries may contain errors; every page links to its sources.</li>
            <li>
              Sections marked “Sample data” show committed fixtures because that agent hasn’t published yet.
            </li>
            <li>Not financial, legal, or investment advice.</li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="built" className="card p-4 text-sm">
        <h2 id="built" className="mb-1 font-semibold">
          Built with
        </h2>
        <p className="text-muted">
          Next.js (static export), TypeScript, Tailwind CSS, Recharts, Leaflet + OpenStreetMap, TanStack
          Table, jsdiff, zod, Vitest, Playwright + axe; agents in Python with Claude.{' '}
          <a className="link" href={REPO_URL}>
            Source on GitHub
          </a>
          .
        </p>
      </section>
    </div>
  );
}
