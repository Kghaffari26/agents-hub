import type { Metadata } from 'next';
import { Bot, ShieldCheck, User, Wrench } from 'lucide-react';
import { getEvals } from '@/lib/data/server';
import { canonical, ogImages } from '@/lib/data/url';
import { CodeBlock } from '@/components/mcp/CodeBlock';
import {
  CONFIG,
  CONVERSATIONS,
  INSTALL,
  MCP_REPO,
  MCP_URL,
  PROMPTS,
  TOOLS,
  type Turn,
} from '@/components/mcp/content';
import { EvalsBody, EvalsSampleNote } from '@/components/evals/EvalsSection';

export function generateMetadata(): Metadata {
  const title = 'Use the agents from Claude (MCP)';
  const description =
    'agents-mcp is a read-only Model Context Protocol server: ask Claude about housing markets, the economy, federal contracts and repo health, answered from the agents’ published data.';
  return {
    title,
    description,
    alternates: { canonical: canonical('/mcp/') },
    ...ogImages('mcp', title, description),
  };
}

const ROLE: Record<Turn['role'], { label: string; Icon: typeof User; cls: string }> = {
  user: { label: 'You', Icon: User, cls: 'ml-auto bg-accent/10 border-accent/30' },
  tool: { label: 'Tool call', Icon: Wrench, cls: 'bg-surface-2 border-border font-mono text-xs' },
  assistant: { label: 'Claude', Icon: Bot, cls: 'bg-surface border-border' },
};

export default function McpPage() {
  const evals = getEvals('agents_mcp');
  return (
    <div className="space-y-10 pb-4">
      <header className="space-y-3 pb-2 pt-8">
        <h1 className="text-2xl font-bold md:text-3xl">Use the agents from Claude</h1>
        <p className="max-w-3xl text-muted">
          <a className="link" href={MCP_URL}>
            agents-mcp
          </a>{' '}
          is a read-only{' '}
          <a className="link" href="https://modelcontextprotocol.io">
            Model Context Protocol
          </a>{' '}
          server over the same data this site shows. Ask Claude “compare Tampa and Orlando for a buyer” or
          “what grants close in two weeks?” and the answer is built from the agents’ published numbers, with
          sources, instead of numbers the model half-remembers. One server works with Claude Desktop, Claude
          Code and any other MCP client.
        </p>
        <ul className="grid max-w-4xl gap-2 text-sm sm:grid-cols-3">
          {[
            [
              'Read-only',
              'Every tool is annotated readOnlyHint; the server only makes HTTP GETs to raw.githubusercontent.com.',
            ],
            [
              'Numbers from the data',
              'Tools return published values verbatim; the only arithmetic is deterministic code (amortization, day counts, sorting).',
            ],
            [
              'Says how fresh it is',
              'Every response carries sample, data_through, last_run, sources and the exact data files read.',
            ],
          ].map(([h, b]) => (
            <li key={h} className="card p-3">
              <p className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="h-4 w-4 text-good" aria-hidden />
                {h}
              </p>
              <p className="mt-1 text-muted">{b}</p>
            </li>
          ))}
        </ul>
      </header>

      <section aria-labelledby="install" className="space-y-3">
        <h2 id="install" className="section-title">
          Install
        </h2>
        <p className="max-w-3xl text-sm text-muted">
          Requires{' '}
          <a className="link" href="https://docs.astral.sh/uv/">
            uv
          </a>
          . Nothing to clone: <code>uvx</code> runs it straight from GitHub.
        </p>
        <div className="grid gap-4 lg:grid-cols-2" data-testid="mcp-install">
          {INSTALL.map((s) => (
            <div key={s.id} className="min-w-0 space-y-2">
              <h3 className="font-semibold">{s.title}</h3>
              <CodeBlock code={s.code} label={`${s.title} (${s.lang})`} />
              <p className="text-xs text-muted">{s.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="examples" className="space-y-3">
        <h2 id="examples" className="section-title">
          Example conversations
        </h2>
        <p className="max-w-3xl text-sm text-muted">
          From the agents-mcp README, answered from the bundled sample data (so each answer says so).
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          {CONVERSATIONS.map((c) => (
            <figure key={c.title} className="card flex flex-col gap-2 p-4" data-testid="mcp-conversation">
              <figcaption className="text-sm font-semibold">{c.title}</figcaption>
              <ol className="flex flex-col gap-2">
                {c.turns.map((t, i) => {
                  const r = ROLE[t.role];
                  return (
                    <li key={i} className={`max-w-[95%] rounded-lg border p-2.5 text-sm ${r.cls}`}>
                      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                        <r.Icon className="h-3 w-3" aria-hidden />
                        {r.label}
                      </p>
                      <p className="whitespace-pre-line break-words leading-relaxed">{t.text}</p>
                    </li>
                  );
                })}
              </ol>
            </figure>
          ))}
        </div>
      </section>

      <section aria-labelledby="tools" className="space-y-3">
        <h2 id="tools" className="section-title">
          Tools
        </h2>
        <div className="card table-wrap">
          <table className="data-table" data-testid="mcp-tools">
            <caption className="sr-only">The 13 read-only tools agents-mcp exposes</caption>
            <thead>
              <tr>
                <th scope="col">Tool</th>
                <th scope="col">Agent</th>
                <th scope="col">Use it for</th>
                <th scope="col">Key arguments</th>
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((t) => (
                <tr key={t.name}>
                  <th scope="row" className="!normal-case !tracking-normal">
                    <code className="font-mono text-xs text-text">{t.name}</code>
                  </th>
                  <td className="whitespace-nowrap">{t.agent}</td>
                  <td className="min-w-[14rem]">{t.use}</td>
                  <td className="min-w-[12rem] text-xs text-muted">{t.args}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-4 text-sm">
            <h3 className="font-semibold">Prompts</h3>
            <ul className="mt-2 space-y-2">
              {PROMPTS.map((p) => (
                <li key={p.name}>
                  <code className="font-mono text-xs">{p.name}</code>
                  {p.args !== '—' && <span className="text-xs text-muted"> ({p.args})</span>}
                  <span className="block text-muted">{p.does}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4 text-sm">
            <h3 className="font-semibold">Resources</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>
                <code className="font-mono text-xs text-text">agents://{'{agent}'}/latest.json</code> and{' '}
                <code className="font-mono text-xs text-text">manifest-entry.json</code> for all four agents
              </li>
              <li>
                <code className="font-mono text-xs text-text">
                  agents://real_estate/metros/{'{slug}'}.json
                </code>{' '}
                (template)
              </li>
              <li>Each returns the file with its source URL and whether it is sample data.</li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="config" className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h2 id="config" className="section-title">
            Configuration
          </h2>
          <div className="card table-wrap">
            <table className="data-table text-sm">
              <caption className="sr-only">Environment variables</caption>
              <thead>
                <tr>
                  <th scope="col">Variable</th>
                  <th scope="col">Default</th>
                  <th scope="col">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {CONFIG.map(([k, d, m]) => (
                  <tr key={k}>
                    <th scope="row" className="!normal-case !tracking-normal">
                      <code className="break-all font-mono text-xs text-text">{k}</code>
                    </th>
                    <td className="break-all text-xs">{d}</td>
                    <td>{m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="section-title">How it gets the data</h2>
          <p className="text-sm leading-relaxed text-muted">
            The server reads each agent’s <code>latest.json</code>, <code>manifest-entry.json</code>,{' '}
            <code>metros/&lt;slug&gt;.json</code> and <code>all.json</code> from its <code>data</code> branch
            and caches them for 10 minutes. If a branch isn’t published yet or a fetch fails, that agent
            switches to sample data bundled from this site’s fixtures, and every response that used it says{' '}
            <code>&quot;sample&quot;: true</code>.
          </p>
        </div>
      </section>

      <section aria-labelledby="mcp-evals" className="card space-y-3 p-4 md:p-5" data-testid="evals-section">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="mcp-evals" className="section-title">
            Eval: does Claude pick the right tool?
          </h2>
          {evals?.sample && <EvalsSampleNote data={evals} />}
        </div>
        <p className="max-w-3xl text-sm text-muted">
          25 natural-language questions, each with the expected tool and checks on its key arguments (the
          metro resolves to <code>austin-tx</code>, <code>min_fit</code> is 80…). The eval sends each one to
          Claude against the real server’s tool list and scores the first tool call.{' '}
          <a className="link" href={`${MCP_URL}/tree/main/evals`}>
            {MCP_REPO}/evals
          </a>
        </p>
        {evals ? (
          <EvalsBody data={evals} chartHeight={220} />
        ) : (
          <p className="text-sm text-muted">No eval history yet.</p>
        )}
      </section>
    </div>
  );
}
