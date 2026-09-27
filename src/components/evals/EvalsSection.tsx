import { FlaskConical, GitCommit } from 'lucide-react';
import type { EvalsData } from '@/lib/schemas/agentic';
import { formatDate, score, usdPrecise } from '@/lib/format';
import { LazyEvalsChart } from './LazyEvalsChart';
import { ScoreDelta } from './ScoreDelta';
import { scoreLabel, summarize } from './evalsModel';

function SampleNote({ data }: { data: EvalsData }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral/60 bg-surface-2 px-2 py-0.5 text-xs font-semibold text-neutral"
      title={`${data.repo} has no evals/history.jsonl on main yet (${data.reason ?? 'not found'}); showing sample eval history.`}
      data-testid="evals-sample-badge"
    >
      <FlaskConical className="h-3 w-3" aria-hidden /> Sample evals
    </span>
  );
}

/** Latest scores per suite (static HTML) + the history chart (client, lazy). */
export function EvalsBody({ data, chartHeight = 260 }: { data: EvalsData; chartHeight?: number }) {
  const suites = summarize(data.entries);
  if (!suites.length) return <p className="text-sm text-muted">No eval runs recorded yet.</p>;
  return (
    <div className="space-y-4">
      <div className="table-wrap">
        <table className="data-table" data-testid="evals-latest">
          <caption className="sr-only">
            Latest eval scores for {data.name}, with the change since the previous run of each suite
          </caption>
          <thead>
            <tr>
              <th scope="col">Suite</th>
              <th scope="col">Score</th>
              <th scope="col" className="text-right">
                Latest
              </th>
              <th scope="col" className="text-right">
                vs previous run
              </th>
            </tr>
          </thead>
          <tbody>
            {suites.flatMap((s) =>
              s.scores.map((sc, i) => (
                <tr key={`${s.suite}-${sc.name}`}>
                  {i === 0 && (
                    <th
                      scope="rowgroup"
                      rowSpan={s.scores.length}
                      className="!normal-case !tracking-normal align-top text-sm text-text"
                    >
                      <span className="font-semibold">{scoreLabel(s.suite)}</span>
                      <span className="block text-xs font-normal text-muted">
                        {s.runs} run{s.runs === 1 ? '' : 's'} · {formatDate(s.latest.ts)}
                      </span>
                    </th>
                  )}
                  <td>{scoreLabel(sc.name)}</td>
                  <td className="num text-right font-semibold">{score(sc.value)}</td>
                  <td className="text-right">
                    <ScoreDelta value={sc.delta} />
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {suites.map((s) => (
          <li key={s.suite} className="inline-flex items-center gap-1">
            <GitCommit className="h-3 w-3" aria-hidden />
            {scoreLabel(s.suite)}: {s.latest.model ?? 'model n/a'}
            {s.latest.prompt_version && <> · prompt {s.latest.prompt_version}</>}
            {s.latest.git_sha && <> · {s.latest.git_sha.slice(0, 7)}</>}
            {s.latest.n_cases != null && <> · {s.latest.n_cases} cases</>}
            {s.latest.usd != null && <> · {usdPrecise(s.latest.usd)}</>}
          </li>
        ))}
      </ul>
      <LazyEvalsChart id={data.id} height={chartHeight} />
    </div>
  );
}

/** "Evals" section on an agent page. */
export function EvalsSection({ data, agentName }: { data: EvalsData | null; agentName: string }) {
  const id = `evals-${data?.id ?? 'none'}`;
  return (
    <section aria-labelledby={id} className="card p-4 md:p-5" data-testid="evals-section">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 id={id} className="section-title">
          Evals
        </h2>
        {data?.sample && <SampleNote data={data} />}
      </div>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Labeled test cases the {agentName} runs before a prompt or model change ships (agents-core evals).
        Scores are 0–100%; a drop beyond the threshold fails the pull request.{' '}
        {data && (
          <a className="link" href={data.source_url}>
            History file
          </a>
        )}
      </p>
      {data ? (
        <EvalsBody data={data} />
      ) : (
        <p className="text-sm text-muted">No eval history published yet.</p>
      )}
    </section>
  );
}

export { SampleNote as EvalsSampleNote };
