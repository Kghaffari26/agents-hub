import { Methodology } from '@/components/common/Methodology';

const PENALTIES: [string, string][] = [
  ['Each untriaged issue older than 7 days', '−3 (cap −30)'],
  ['Each stale PR (no activity for 14 days)', '−5 (cap −25)'],
  ['Median first response over 72 hours', '−10 (over 168 h: −15)'],
  ['Default-branch CI failing', '−20'],
  ['10+ merged PRs since a release more than 90 days old', '−10'],
  ['Missing README, LICENSE or CONTRIBUTING', '−3 each (cap −9)'],
];

/** How the repo numbers are computed (SPEC_REPO_MAINT §5, §8). */
export function RepoMethodology() {
  return (
    <Methodology>
      <h3>Untriaged issues</h3>
      <p>
        An open issue (not a PR) is <strong>untriaged</strong> when it has none of the repo&apos;s triage
        labels, no maintainer (owner, member or collaborator) has commented, and it isn&apos;t labeled with an
        ignore label such as
        <code> wontfix</code>. Classification, priority and suggested labels come from a model; duplicate
        candidates come from TF-IDF similarity (≥ 45%) and are shown only when the model confirms them.
      </p>
      <h3>Health score</h3>
      <p>
        Every repo starts at 100; each penalty below is subtracted and listed in the card&apos;s breakdown.
      </p>
      <div className="table-wrap">
        <table className="data-table text-text">
          <caption className="sr-only">Health score penalties</caption>
          <thead>
            <tr>
              <th scope="col">Condition</th>
              <th scope="col">Penalty</th>
            </tr>
          </thead>
          <tbody>
            {PENALTIES.map(([cond, pts]) => (
              <tr key={cond}>
                <td>{cond}</td>
                <td className="num whitespace-nowrap">{pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <strong>Grades:</strong> A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F below 60. Median first response covers
        issues opened in the last 90 days, ignoring the author and bots; issues with no reply yet are counted
        separately.
      </p>
      <h3>Stale-PR nudges</h3>
      <p>
        Nudges are fixed templates chosen by review and CI state (no AI). They are{' '}
        <strong>shown only on this site</strong> for a maintainer to copy; the agent never posts them.
      </p>
      <h3>Safety: report vs apply mode</h3>
      <p>
        In <strong>report mode</strong> the agent only reads from GitHub and lists what it would do. In{' '}
        <strong>apply mode</strong> it may add allow-listed labels that already exist (never remove) and post
        at most one triage comment per issue, and only when every gate passes: the apply flag and repo
        variable are set, the repo allows it, the repo is owned or a sandbox (never a public demo repo), and a
        write token exists. Writes are capped per run and per repo per day; anything blocked is logged as
        planned or skipped with the reason.
      </p>
      <h3>Changelog drafts</h3>
      <p>
        Drafts list merged PRs (or commits when there are none) since the latest release tag. The suggested
        version is computed in code from labels and conventional-commit prefixes. Drafts are rendered as
        sanitized Markdown with raw HTML removed.
      </p>
    </Methodology>
  );
}
