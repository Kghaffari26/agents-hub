import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

// Build-time loaders read public/data (a copy of the fixtures unless live data was fetched).
describe('/macro page', () => {
  it('renders every section from fixture data', async () => {
    const mod = await import('@/app/macro/page');
    const meta = mod.generateMetadata();
    expect(meta.title).toMatch(/^Macro dashboard — CPI \S+% \w+ \(\w+ \d{4}\)$/);
    render(<mod.default />);
    expect(screen.getByRole('heading', { level: 1, name: 'Macro & Fed' })).toBeInTheDocument();
    for (const id of ['regime-strip', 'yield-curve', 'fomc-panel', 'statement-diff', 'release-calendar']) {
      expect(await screen.findByTestId(id)).toBeInTheDocument(); // yield curve is code-split
    }
    expect(screen.getByTestId('indicator-card-payrolls')).toBeInTheDocument();
    expect(screen.getByTestId('tone-shift')).toHaveTextContent(/Tone: /);
  });
});
