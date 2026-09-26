import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { repoMaintLatest, type Repo } from '@/lib/schemas/repoMaint';
import { RepoCard } from '@/components/repos/RepoCard';
import { ChangelogDraft } from '@/components/repos/ChangelogDraft';
import { ActionsLog } from '@/components/repos/ActionsLog';
import { ModeBadge } from '@/components/repos/ModeBadge';
import { CopyButton } from '@/components/repos/CopyButton';
import { TriageTable } from '@/components/repos/TriageTable';
import { StalePrs } from '@/components/repos/StalePrs';
import { formatHours, actionLabel } from '@/components/repos/labels';

const fixture = repoMaintLatest.parse(
  JSON.parse(readFileSync(path.resolve(__dirname, '../../fixtures/repo_maint/latest.json'), 'utf8')),
);
const repo = fixture.repos[0];
const changelog = fixture.repos.find((r) => r.changelog)!.changelog!;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RepoCard', () => {
  it('renders the grade, score and counts', () => {
    render(<RepoCard repo={repo} />);
    const card = screen.getByTestId('repo-card');
    expect(within(card).getByRole('heading', { level: 3, name: repo.full_name })).toBeInTheDocument();
    expect(within(card).getByText(repo.health.grade)).toBeInTheDocument();
    expect(within(card).getByText(/Untriaged/)).toBeInTheDocument();
    expect(
      within(card).getByRole('img', { name: /12 weeks: \d+ issues opened, \d+ closed/ }),
    ).toBeInTheDocument();
  });

  it('opens the penalty breakdown on keyboard focus, click and Escape closes it', () => {
    render(<RepoCard repo={repo} />);
    const panel = screen.getByTestId('health-breakdown');
    expect(panel).not.toBeVisible();
    const btn = screen.getByRole('button', { name: /Health grade/ });
    act(() => btn.focus());
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(within(panel).getByText(repo.health.breakdown[0].reason)).toBeInTheDocument();
    fireEvent.keyDown(btn, { key: 'Escape' });
    expect(panel).not.toBeVisible();
    act(() => btn.blur());
    fireEvent.click(btn);
    expect(panel).toBeVisible();
    fireEvent.click(btn);
    expect(panel).not.toBeVisible();
  });

  it('opens on hover', () => {
    render(<RepoCard repo={repo} />);
    const panel = screen.getByTestId('health-breakdown');
    fireEvent.mouseEnter(panel.parentElement!);
    expect(panel).toBeVisible();
  });

  it('shows the demo note and partial badge', () => {
    const demo: Repo = { ...repo, role: 'public_demo', partial: true, median_first_response_hours: null };
    render(<RepoCard repo={demo} />);
    expect(screen.getByText(/Not affiliated; read-only demo/)).toBeInTheDocument();
    expect(screen.getByText('Partial data')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});

describe('ChangelogDraft', () => {
  it('renders markdown headings and strips raw HTML', () => {
    const md = [
      '## [1.0.0] - Unreleased',
      '',
      '### Added',
      '- Thing (#1)',
      '',
      '<script>alert(1)</script>',
      '',
      '<img src="x" onerror="alert(1)">',
      '',
      '[bad](javascript:alert(1))',
      '',
      '![pic](https://example.com/a.png)',
    ].join('\n');
    const { container } = render(
      <ChangelogDraft
        repoName="o/r"
        changelog={{ ...changelog, markdown: md, base_ref: 'v0.3.0', base_date: '2026-08-20' }}
      />,
    );
    expect(screen.getByTestId('changelog-draft')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '[1.0.0] - Unreleased' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Added' })).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(container.innerHTML).not.toContain('javascript:');
    expect(screen.getByText('since v0.3.0 · Aug 20, 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy Markdown/ })).toBeInTheDocument();
  });

  it('labels AI vs template drafts', () => {
    const { rerender } = render(
      <ChangelogDraft repoName="o/r" changelog={{ ...changelog, narrative_source: 'llm', model: 'm-1' }} />,
    );
    expect(screen.getByText(/AI-drafted · m-1/)).toBeInTheDocument();
    rerender(
      <ChangelogDraft
        repoName="o/r"
        changelog={{ ...changelog, narrative_source: 'template', model: null }}
      />,
    );
    expect(screen.getByText(/Template \(no AI\)/)).toBeInTheDocument();
  });
});

describe('ActionsLog', () => {
  it('renders every status as text, action labels and issue links', () => {
    render(<ActionsLog actions={fixture.actions} mode="report" />);
    const log = screen.getByTestId('actions-log');
    expect(within(log).getAllByText('Planned').length).toBeGreaterThan(0);
    expect(within(log).getAllByText('Applied').length).toBeGreaterThan(0);
    expect(within(log).getAllByText('Skipped').length).toBeGreaterThan(0);
    expect(within(log).getAllByText('Add labels').length).toBeGreaterThan(0);
    expect(within(log).getAllByText('Comment').length).toBeGreaterThan(0);
    expect(within(log).getByText(/lists what it would do/)).toBeInTheDocument();
    const a = fixture.actions[0];
    const link = within(log).getAllByRole('link', { name: `#${a.target}` })[0];
    expect(link).toHaveAttribute('href', `https://github.com/${a.repo}/issues/${a.target}`);
  });
});

describe('ModeBadge', () => {
  it('shows report vs apply text', () => {
    const { rerender } = render(<ModeBadge mode="report" />);
    expect(screen.getByTestId('mode-badge')).toHaveTextContent('Report mode (read-only)');
    rerender(<ModeBadge mode="apply" />);
    expect(screen.getByTestId('mode-badge')).toHaveTextContent('Apply mode');
  });
});

describe('CopyButton', () => {
  it('writes to the clipboard and announces Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CopyButton text="hello nudge" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    });
    expect(writeText).toHaveBeenCalledWith('hello nudge');
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
  });
});

describe('TriageTable and StalePrs', () => {
  it('renders the Applied column only in apply mode', () => {
    const { rerender } = render(<TriageTable repos={fixture.repos} mode="apply" />);
    expect(screen.getByTestId('triage-table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Applied' })).toBeInTheDocument();
    rerender(<TriageTable repos={fixture.repos} mode="report" />);
    expect(screen.queryByRole('columnheader', { name: 'Applied' })).toBeNull();
  });

  it('renders stale PRs with review state words and a copy button', () => {
    render(<StalePrs repos={fixture.repos} />);
    const list = screen.getByTestId('stale-prs');
    expect(within(list).getAllByRole('button', { name: /Copy/ }).length).toBeGreaterThan(0);
    expect(
      within(list).getAllByText(/Review requested|Changes requested|Approved|No review yet|Commented/).length,
    ).toBeGreaterThan(0);
  });
});

describe('labels', () => {
  it('formats hours and action types', () => {
    expect(formatHours(null)).toBe('—');
    expect(formatHours(30.2)).toBe('30h');
    expect(formatHours(80.5)).toBe('3.4 days');
    expect(actionLabel('add_labels')).toBe('Add labels');
    expect(actionLabel('comment')).toBe('Comment');
  });
});

describe('/repos page', () => {
  it('renders every section from the published data', async () => {
    const { default: ReposPage, generateMetadata } = await import('@/app/repos/page');
    render(<ReposPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Repo Maintenance' })).toBeInTheDocument();
    expect(screen.getByTestId('mode-badge')).toBeInTheDocument();
    expect(screen.getAllByTestId('repo-card').length).toBeGreaterThan(0);
    for (const id of ['triage-table', 'stale-prs', 'actions-log'])
      expect(screen.getByTestId(id)).toBeInTheDocument();
    const meta = generateMetadata();
    expect(String(meta.title)).toMatch(/^Repo maintenance — \d+ repos?, avg health \d+$/);
  });
});
