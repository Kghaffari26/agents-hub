import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import GrantsPage, { generateMetadata } from '@/app/grants/page';
import { getGrantsLatest } from '@/lib/data/server';

describe('/grants page', () => {
  it('renders header, profile chip, summary, cards, timeline and profile anchor', () => {
    render(<GrantsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Grants & Contracts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Matching for:/ })).toHaveAttribute('href', '#profile');
    // public/data may be live agent output or fixtures; the page shows up to 10 top matches.
    expect(screen.getAllByTestId('match-card')).toHaveLength(
      Math.min(10, getGrantsLatest().top_matches.length),
    );
    expect(screen.getByTestId('deadline-timeline')).toBeInTheDocument();
    expect(document.getElementById('profile')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Load all/ })).toBeInTheDocument();
  });

  it('builds data-driven metadata', () => {
    const m = generateMetadata();
    expect(String(m.title)).toMatch(/^Grants & contracts — \d+ new match/);
    expect(m.alternates?.canonical).toMatch(/\/grants\/$/);
  });
});
