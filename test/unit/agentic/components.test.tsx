import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { trace, evalEntry, type TraceSpan } from '@/lib/schemas/agentic';
import { grantsLatest } from '@/lib/schemas/grants';
import { repoMaintLatest } from '@/lib/schemas/repoMaint';
import { metroDetail, realEstateLatest } from '@/lib/schemas/realEstate';
import { macroLatest } from '@/lib/schemas/macro';
import { manifest } from '@/lib/schemas/manifest';
import { describeSpan, filterRows, layoutTrace, visibleRows } from '@/components/trace/traceModel';
import { TraceView } from '@/components/trace/TraceView';
import { RunTrace } from '@/components/trace/RunTrace';
import { summarize, scoreLabel } from '@/components/evals/evalsModel';
import { ScoreDelta } from '@/components/evals/ScoreDelta';
import { parseDiff, diffFiles } from '@/components/repos/diff';
import { FixProposals, statusLabel } from '@/components/repos/FixProposals';
import { BidResearch } from '@/components/grants/BidResearch';
import { Investigations } from '@/components/real-estate/Investigations';
import { WhatsDriving, triggerLabel } from '@/components/macro/WhatsDriving';
import { InlineText } from '@/components/agentic/LoopParts';
import { resolveRepoUrl } from '@/components/case-studies/CaseStudyMarkdown';
import { stripSeries } from '@/components/macro/helpers';
import { duration, usdPrecise, score, scoreDelta } from '@/lib/format';

const j = (p: string) => JSON.parse(readFileSync(`test/fixtures/${p}`, 'utf8'));

const span = (
  id: string,
  parent: string | null,
  startMs: number,
  dur: number,
  extra: Partial<TraceSpan> = {},
): TraceSpan => ({
  id,
  parent_id: parent,
  kind: 'custom',
  name: id,
  started_at: new Date(Date.UTC(2026, 8, 26, 0, 0, 0, startMs)).toISOString(),
  duration_ms: dur,
  status: 'ok',
  error: null,
  attrs: {},
  ...extra,
});

describe('trace model', () => {
  const spans = [
    span('s3', 's1', 500, 100, {
      kind: 'llm_call',
      attrs: {
        model: 'claude-x',
        input_tokens: 1500,
        output_tokens: 200,
        usd: 0.0021,
        stop_reason: 'end_turn',
      },
    }),
    span('s1', null, 0, 1000, { kind: 'run' }),
    span('s2', 's1', 10, 300, { kind: 'phase' }),
    span('s4', 's2', 20, 50, {
      kind: 'http',
      attrs: { status: 429, retries: 2, url: 'https://api.x/a?k=***' },
    }),
    span('s5', 'gone', 900, 10, { kind: 'tool_call', status: 'error', error: 'ToolError: timeout' }),
  ];
  it('orders depth-first by start and treats orphans as roots', () => {
    const { rows, total } = layoutTrace(spans);
    expect(rows.map((r) => [r.span.id, r.depth])).toEqual([
      ['s1', 0],
      ['s2', 1],
      ['s4', 2],
      ['s3', 1],
      ['s5', 0],
    ]);
    expect(total).toBe(1000);
    expect(rows.find((r) => r.span.id === 's4')!.ancestors).toEqual(['s1', 's2']);
  });
  it('filters keep ancestors; collapsing hides descendants', () => {
    const { rows } = layoutTrace(spans);
    expect(filterRows(rows, 'agentic').map((r) => r.span.id)).toEqual(['s1', 's3', 's5']);
    expect(filterRows(rows, 'errors').map((r) => r.span.id)).toEqual(['s5']);
    expect(visibleRows(rows, new Set(['s2'])).map((r) => r.span.id)).toEqual(['s1', 's2', 's3', 's5']);
  });
  it('describes spans in words', () => {
    const { rows } = layoutTrace(spans);
    const d = (id: string) => describeSpan(rows.find((r) => r.span.id === id)!.span);
    expect(d('s3')).toBe('claude-x · 1.5K in / 200 out tokens · $0.0021 · stop: end_turn');
    expect(d('s4')).toBe('429 · 2 retries · /a');
    expect(d('s5')).toMatch(/error: ToolError: timeout/);
  });
  it('formats latency and cost', () => {
    expect(duration(340)).toBe('340 ms');
    expect(duration(1234)).toBe('1.2 s');
    expect(duration(252_000)).toBe('4 min 12 s');
    expect(duration(null)).toBe('—');
    expect(usdPrecise(0.0068)).toBe('$0.0068');
    expect(usdPrecise(0.093)).toBe('$0.093');
    expect(score(0.864)).toBe('86%');
    expect(scoreDelta(-0.04)).toBe('−4 pts');
  });
});

describe('TraceView', () => {
  const t = trace.parse(j('grants/trace.json'));
  it('switches between the timeline and the text table, and filters', () => {
    render(<TraceView spans={t.spans} />);
    expect(screen.getByTestId('trace-timeline')).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('trace-view-toggle')).getByRole('radio', { name: 'Table' }));
    const table = screen.getByTestId('trace-table');
    expect(within(table).getAllByRole('row').length).toBe(t.spans.length + 1);
    fireEvent.click(
      within(screen.getByTestId('trace-filter')).getByRole('radio', { name: 'Errors & retries' }),
    );
    // The timed-out get_award call and its ancestors.
    expect(within(screen.getByTestId('trace-table')).getByText(/Error\./)).toBeInTheDocument();
  });
  it('collapses a subtree from its toggle', () => {
    render(<TraceView spans={t.spans} />);
    const before = screen.getByTestId('trace-timeline').querySelectorAll('li').length;
    fireEvent.click(screen.getByRole('button', { name: /Collapse fetch/ }));
    expect(screen.getByTestId('trace-timeline').querySelectorAll('li').length).toBeLessThan(before);
    expect(screen.getByRole('button', { name: /Expand fetch/ })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('RunTrace', () => {
  const agents = manifest.parse({
    generated_at: '2026-09-26T00:00:00Z',
    agents: [{ ...j('macro/manifest-entry.json'), sample: true }],
  }).agents;
  it('shows the roll-up from the manifest', () => {
    render(<RunTrace agent={agents[0]} info={null} />);
    const s = screen.getByTestId('trace-summary');
    const t = agents[0].trace_summary!;
    expect(within(s).getByText('LLM calls').nextSibling).toHaveTextContent(String(t.llm_calls));
    expect(within(s).getByText('Guard retries').nextSibling).toHaveTextContent(String(t.guard_retries));
  });
  it('says so when an agent has no trace yet', () => {
    render(<RunTrace agent={{ ...agents[0], trace_summary: null }} info={null} />);
    expect(screen.getByText(/No trace yet/)).toBeInTheDocument();
  });
});

describe('evals', () => {
  const e = (ts: string, suite: string, scores: Record<string, number>, pass_rate: number | null = null) =>
    evalEntry.parse({
      ts,
      suite,
      prompt_version: null,
      git_sha: null,
      model: null,
      scores,
      pass_rate,
      usd: null,
      n_cases: null,
    });
  it('summarizes the latest run per suite with deltas', () => {
    const s = summarize([
      e('2026-09-01T00:00:00Z', 'a', { x: 0.5 }, 0.4),
      e('2026-09-08T00:00:00Z', 'a', { x: 0.75 }, 0.5),
      e('2026-09-08T00:00:00Z', 'b', { y: 1 }),
    ]);
    expect(s[0]).toMatchObject({ suite: 'a', runs: 2 });
    expect(s[0].scores).toEqual([
      { name: 'x', value: 0.75, delta: 0.25 },
      { name: 'pass_rate', value: 0.5, delta: 0.1 },
    ]);
    expect(s[1].scores).toEqual([{ name: 'y', value: 1, delta: null }]);
    expect(scoreLabel('fomc_read')).toBe('FOMC read');
    expect(scoreLabel('llm_judge')).toBe('LLM judge');
  });
  it('shows direction with an arrow and text, and ±0 as flat', () => {
    const { container, rerender } = render(<ScoreDelta value={0.04} />);
    expect(container).toHaveTextContent('▲+4 pts');
    rerender(<ScoreDelta value={-0.001} />);
    expect(container).toHaveTextContent('±0 pts');
    expect(container.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'flat');
    rerender(<ScoreDelta value={null} />);
    expect(container).toHaveTextContent('first run');
  });
});

describe('fix proposals', () => {
  const data = repoMaintLatest.parse(j('repo_maint/latest.json'));
  const items = data.repos.flatMap((r) =>
    (r.fix_proposals ?? []).map((proposal) => ({ repo: r.full_name, proposal })),
  );
  it('parses unified diffs', () => {
    const p = items[0].proposal;
    const files = diffFiles(parseDiff(p.diff!));
    expect(files.map((f) => f.path)).toEqual(p.files_changed);
    expect(files.reduce((s, f) => s + f.additions, 0)).toBe(p.lines_added);
  });
  it('labels proposals as awaiting human review and shows the diff', () => {
    expect(statusLabel({ status: 'proposed', pr_url: null }).text).toBe('Draft PR — awaiting human review');
    expect(statusLabel({ status: 'pr_opened', pr_url: 'https://github.com/x/y/pull/1' }).awaiting).toBe(true);
    expect(statusLabel({ status: 'no_fix', pr_url: null })).toEqual({
      text: 'No small, safe fix found',
      awaiting: false,
    });
    expect(statusLabel({ status: 'merged', pr_url: null }).text).toBe('Merged');
    render(<FixProposals items={items} />);
    const status = screen.getAllByTestId('fix-status');
    expect(status[0]).toHaveTextContent('Draft PR — awaiting human review');
    expect(status[1]).toHaveTextContent('No small, safe fix found');
    expect(screen.getAllByTestId('diff-preview')).toHaveLength(1); // the no_fix proposal has no diff
    const diff = screen.getByTestId('diff-preview');
    expect(diff.querySelector('[data-kind="add"]')?.textContent).toMatch(/^\+/);
    expect(diff.querySelector('[data-kind="del"]')?.textContent).toMatch(/^-/);
    expect(screen.getAllByText('csvField')[0].tagName).toBe('CODE');
    expect(screen.getByText(/approves proposal/)).toHaveTextContent('7c41e09a2b3f');
  });
  it('says so when there are none', () => {
    render(<FixProposals items={[]} />);
    expect(screen.getByText('No fix proposals this run.')).toBeInTheDocument();
  });
});

describe('bid research', () => {
  const g = grantsLatest.parse(j('grants/latest.json'));
  const m = g.top_matches.find((x) => x.research)!;
  it('shows go/no-go in words, prior awards and USAspending citations', () => {
    render(<BidResearch research={m.research!} title={m.title} />);
    expect(screen.getByTestId('bid-research')).toHaveTextContent('Go');
    const cites = screen.getByTestId('usaspending-citations');
    expect(within(cites).getAllByRole('link')).toHaveLength(m.research!.prior_awards.length);
    expect(screen.getByText('Prior awards (USAspending)')).toBeInTheDocument();
  });
  it('flags partial research', () => {
    render(
      <BidResearch
        research={{ ...m.research!, status: 'partial', stop_reason: 'max_usd', go_no_go: 'no_go' }}
        title="x"
      />,
    );
    expect(screen.getByText(/Partial research: the loop stopped at its cost budget/)).toBeInTheDocument();
    expect(screen.getAllByText('No-go').length).toBeGreaterThan(0);
  });
});

describe('investigations and drivers', () => {
  it('shows the index summary with cited metrics, and the full explanation on the metro page', () => {
    const idx = realEstateLatest.parse(j('real_estate/latest.json'));
    const detroit = metroDetail.parse(j('real_estate/metros/detroit-mi.json')).investigation!;
    const { unmount } = render(
      <Investigations items={idx.investigations} metros={idx.metros} registry={idx.metric_registry} />,
    );
    const card = screen.getByTestId('investigation-card');
    expect(within(card).getByRole('link', { name: 'Detroit, MI' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Top mover: Median price +6.6% YoY');
    // median_sale_price value + YoY from the metro summary, formatted by the registry
    expect(within(card).getByTestId('cited-metrics')).toHaveTextContent(
      /Median sale price\s*\$211,600\s*\+6\.6% YoY/,
    );
    unmount();
    render(
      <Investigations
        items={idx.investigations}
        metros={idx.metros}
        registry={idx.metric_registry}
        focusSlug="detroit-mi"
        focus={detroit}
      />,
    );
    expect(screen.getByTestId('investigation-focus')).toHaveTextContent(detroit.explanation);
    expect(screen.queryByTestId('investigation-card')).toBeNull(); // not repeated below
    expect(screen.getByText(/Tool calls, finished \(4 calls\)/)).toBeInTheDocument();
  });
  it("renders fed-agent's investigation with its trigger, cited series and loop", () => {
    const m = macroLatest.parse(j('macro/latest.json'));
    render(<WhatsDriving investigation={m.investigation} indicators={m.indicators.map(stripSeries)} />);
    expect(screen.getByTestId('driving-trigger')).toHaveTextContent('Trigger: FOMC decision, Sep 16, 2026');
    expect(within(screen.getByTestId('cited-series')).getAllByRole('link')).toHaveLength(4);
    expect(screen.getByText(/Tool calls, finished \(6 calls\)/)).toBeInTheDocument();
    expect(screen.getByText(/number guard sent the first draft back/)).toBeInTheDocument();
    const names = new Map([['cpi', 'CPI (all items)']]);
    expect(
      triggerLabel(
        { event_id: 'new_release:CPIAUCSL:2026-08', type: 'new_release', indicator_id: 'cpi' },
        names,
      ),
    ).toBe('New CPI (all items) release');
    const { container } = render(<WhatsDriving investigation={null} indicators={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('renders nothing for older data', () => {
    const { container } = render(<Investigations items={undefined} metros={[]} registry={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('small helpers', () => {
  it('InlineText renders only backtick code', () => {
    const { container } = render(<InlineText text={'use `a<b>` then <i>x</i>'} />);
    expect(container.querySelector('code')?.textContent).toBe('a<b>');
    expect(container.querySelector('i')).toBeNull();
  });
  it('case-study links resolve like GitHub', () => {
    expect(resolveRepoUrl('evals/README.md', 'o/r')).toBe(
      'https://github.com/o/r/blob/main/docs/evals/README.md',
    );
    expect(resolveRepoUrl('../README.md', 'o/r')).toBe('https://github.com/o/r/blob/main/README.md');
    expect(resolveRepoUrl('/img/a.png', 'o/r', 'main', true)).toBe(
      'https://raw.githubusercontent.com/o/r/main/img/a.png',
    );
    expect(resolveRepoUrl('https://x.test', 'o/r')).toBe('https://x.test');
    expect(resolveRepoUrl('javascript:alert(1)', 'o/r')).toBe('');
  });
});
