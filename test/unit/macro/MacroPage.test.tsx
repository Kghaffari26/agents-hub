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
    // public/data may be live agent output or fixtures, so optional parts follow the data.
    const { getMacro } = await import('@/lib/data/server');
    const data = getMacro();
    const latest = data.fomc.latest;
    const ids = ['regime-strip', 'yield-curve', 'fomc-panel', 'release-calendar'];
    if (latest) ids.push('statement-diff');
    for (const id of ids) {
      expect(await screen.findByTestId(id)).toBeInTheDocument(); // yield curve is code-split
    }
    expect(screen.getByTestId(`indicator-card-${data.indicators[0].id}`)).toBeInTheDocument();
    if (latest?.read) expect(screen.getByTestId('tone-shift')).toHaveTextContent(/Tone: /);
    else expect(screen.queryByTestId('tone-shift')).toBeNull();
  });
});
