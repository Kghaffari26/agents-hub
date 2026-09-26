import { readFileSync } from 'node:fs';
import path from 'node:path';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { macroLatest, type Indicator } from '@/lib/schemas/macro';
import { IndicatorCard } from '@/components/macro/IndicatorCard';
import { revisionText, stripSeries } from '@/components/macro/helpers';

const data = macroLatest.parse(
  JSON.parse(readFileSync(path.resolve(__dirname, '../../fixtures/macro/latest.json'), 'utf8')),
);
const byId = (id: string) => data.indicators.find((i) => i.id === id)!;

function Harness({ ind }: { ind: Indicator }) {
  const [open, setOpen] = useState(false);
  return (
    <IndicatorCard
      indicator={stripSeries(ind)}
      series={ind.series}
      expanded={open}
      onToggle={() => setOpen((o) => !o)}
    />
  );
}

describe('IndicatorCard', () => {
  it('shows the payrolls revision badge', () => {
    render(<Harness ind={byId('payrolls')} />);
    expect(screen.getByTestId('revision-badge')).toHaveTextContent('Jul revised: +73K → +41K');
  });

  it('shows value, change with arrow and sign, and next release', () => {
    render(<Harness ind={byId('payrolls')} />);
    const card = screen.getByTestId('indicator-card-payrolls');
    expect(within(card).getByText('+22K')).toBeInTheDocument();
    expect(card).toHaveTextContent('▼−19K');
    expect(card).toHaveTextContent('Next release: Oct 2');
    expect(card).toHaveTextContent('+61K');
  });

  it('formats percent-unit MoM values (0.3 → +0.3%)', () => {
    render(<Harness ind={byId('cpi')} />);
    expect(screen.getByTestId('indicator-card-cpi')).toHaveTextContent('+0.3%');
  });

  it('shows the delayed badge only when delayed', () => {
    render(<Harness ind={byId('gdp')} />);
    expect(screen.getByText('Release delayed')).toBeInTheDocument();
    expect(screen.queryByTestId('revision-badge')).toBeNull();
  });

  it('has no badges for a plain indicator', () => {
    render(<Harness ind={byId('cpi')} />);
    expect(screen.queryByText('Release delayed')).toBeNull();
    expect(screen.queryByTestId('revision-badge')).toBeNull();
  });

  it('toggles aria-expanded and shows the chart with a range toggle', async () => {
    render(<Harness ind={byId('cpi')} />);
    const btn = screen.getByRole('button', { name: /CPI \(all items\)/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('indicator-card-cpi')).toHaveClass('col-span-full');
    // The chart is code-split (next/dynamic), so wait for it.
    expect(await screen.findByRole('button', { name: '10Y' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: '10Y' }));
    expect(screen.getByRole('button', { name: '10Y' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'View data table' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders missing values as a dash', () => {
    const ind = byId('cpi');
    render(<Harness ind={{ ...ind, primary: { ...ind.primary, value: null }, change: null }} />);
    expect(screen.getByTestId('indicator-card-cpi')).toHaveTextContent('—');
  });
});

describe('revisionText', () => {
  it('uses the first word of the period label', () => {
    expect(
      revisionText({ period_label: 'Jul 2026', old: 73, new: 41, format: 'count_signed_thousands' }),
    ).toBe('Jul revised: +73K → +41K');
  });
});
