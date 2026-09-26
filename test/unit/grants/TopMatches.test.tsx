import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import latestFixture from '../../fixtures/grants/latest.json';
import { grantsLatest } from '@/lib/schemas/grants';
import { TopMatches, topByFit } from '@/components/grants/TopMatches';
import { DeadlineTimeline, assignLanes } from '@/components/grants/DeadlineTimeline';
import { valueText, countdownText } from '@/components/grants/MatchCard';
import { profileSummary } from '@/components/grants/ProfileChip';

const latest = grantsLatest.parse(latestFixture);

describe('TopMatches', () => {
  it('renders the top 10 cards by fit with meters, badges and official links', async () => {
    render(<TopMatches matches={latest.top_matches} total={latest.top_matches.length} />);
    const cards = screen.getAllByTestId('match-card');
    expect(cards).toHaveLength(10);
    const top = topByFit(latest.top_matches);
    const first = within(cards[0]);
    expect(first.getByRole('heading', { level: 3, name: top[0].title })).toBeInTheDocument();
    expect(first.getByRole('meter', { name: 'Fit score' })).toHaveAttribute(
      'aria-valuenow',
      String(top[0].fit),
    );
    expect(first.getByRole('meter', { name: 'Capability sub-score' })).toHaveAttribute('aria-valuemax', '40');
    expect(first.getByText(top[0].recommendation)).toBeInTheDocument();
    expect(first.getByRole('link', { name: /View on SAM\.gov/ })).toHaveAttribute('href', top[0].url);
    expect(first.getAllByText('Department of Veterans Affairs', { exact: false })[0]).toBeInTheDocument();
    const toggle = first.getByRole('button', { name: 'Show full summary' });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('formats values and countdowns', () => {
    expect(valueText({ kind: 'none', amount: null }).text).toBe('Not disclosed');
    expect(valueText({ kind: 'award_ceiling', amount: 1_000_000, floor: 25_000 })).toEqual({
      label: 'Award ceiling',
      text: '$1,000,000 (floor $25,000)',
    });
    expect(valueText({ kind: 'estimate', amount: 450_000 }).label).toBe('Estimated value');
    expect(countdownText(6)).toBe('Closes in 6 days');
    expect(countdownText(null)).toBe('No deadline listed');
  });

  it('summarises the profile', () => {
    expect(profileSummary(latest.profile)).toBe(
      'Small software consultancy · NAICS 541511, 541512 · Small business',
    );
  });
});

describe('DeadlineTimeline', () => {
  it('renders an accessible list fallback', () => {
    render(<DeadlineTimeline items={latest.deadlines_30d} topIds={[]} />);
    expect(screen.getByTestId('deadline-timeline')).toBeInTheDocument();
  });

  it('puts close markers in separate lanes', () => {
    expect(assignLanes([0.1, 0.11, 0.5])).toEqual([0, 1, 0]);
  });
});
