import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetroPicker } from '@/components/real-estate/MetroPicker';
import { AffordabilityView } from '@/components/real-estate/AffordabilityCalc';
import { LastUpdated } from '@/components/common/LastUpdated';
import { StatCard } from '@/components/common/StatCard';
import { metroDetail } from '@/lib/schemas/realEstate';

const OPTIONS = [
  { slug: 'austin-tx', name: 'Austin, TX' },
  { slug: 'atlanta-ga', name: 'Atlanta, GA' },
  { slug: 'denver-co', name: 'Denver, CO' },
  { slug: 'tampa-fl', name: 'Tampa, FL' },
];

function Picker({ initial = [] as string[] }) {
  const [sel, setSel] = useState(initial);
  return <MetroPicker options={OPTIONS} selected={sel} onChange={setSel} />;
}

describe('MetroPicker', () => {
  it('filters by type-ahead and selects with the keyboard', async () => {
    const user = userEvent.setup();
    render(<Picker />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'aus');
    const list = screen.getByRole('listbox');
    expect(
      within(list)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Austin, TX']);
    await user.keyboard('{Enter}');
    expect(screen.getAllByTestId('metro-chip').map((c) => c.dataset.slug)).toEqual(['austin-tx']);
  });
  it('arrow keys move the active option (aria-activedescendant)', async () => {
    const user = userEvent.setup();
    render(<Picker />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    const active = input.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    expect(document.getElementById(active!)).toHaveAttribute('aria-selected', 'true');
  });
  it('removes chips and caps at 3', async () => {
    const user = userEvent.setup();
    render(<Picker initial={['austin-tx', 'denver-co']} />);
    await user.type(screen.getByRole('combobox'), 'tam{Enter}');
    expect(screen.getAllByTestId('metro-chip')).toHaveLength(3);
    expect(screen.getByRole('combobox')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove Denver, CO' }));
    expect(screen.getAllByTestId('metro-chip').map((c) => c.dataset.slug)).toEqual(['austin-tx', 'tampa-fl']);
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });
  it('offers the United States pseudo-metro', async () => {
    const user = userEvent.setup();
    render(<Picker />);
    await user.type(screen.getByRole('combobox'), 'united');
    expect(screen.getByRole('option', { name: /United States/ })).toBeInTheDocument();
  });
});

describe('AffordabilityCalc', () => {
  const detail = metroDetail.parse(
    JSON.parse(readFileSync('test/fixtures/real_estate/metros/austin-tx.json', 'utf8')),
  );
  it('defaults reproduce the agent payment; inputs → outputs', () => {
    render(
      <AffordabilityView
        metros={OPTIONS}
        metroSlug="austin-tx"
        onMetroChange={() => {}}
        detail={detail}
        defaults={{ rate: 6.18 }}
      />,
    );
    const pi = screen.getByTestId('calc-pi');
    expect(pi.textContent).toBe(
      `$${detail.affordability.payment_now!.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    );
    fireEvent.change(screen.getByLabelText('Home price ($)'), { target: { value: '500000' } });
    fireEvent.change(screen.getByLabelText('Interest rate (%)'), { target: { value: '6.5' } });
    expect(pi.textContent).toBe('$2,528.27');
    fireEvent.click(screen.getByLabelText('15 years'));
    expect(pi.textContent).not.toBe('$2,528.27');
    expect(screen.getByTestId('calc-income').textContent).toMatch(/^\$[\d,]+\/yr$/);
  });
});

describe('LastUpdated', () => {
  it('shows a stale badge when older than 2× the interval', () => {
    vi.useFakeTimers({ now: new Date('2026-09-26T12:00:00Z') });
    render(<LastUpdated at="2026-09-20T12:00:00Z" intervalHours={24} />);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.getByText('Stale')).toBeInTheDocument();
    vi.useRealTimers();
  });
  it('fresh data has no stale badge; unchanged data says "no new data since"', () => {
    vi.useFakeTimers({ now: new Date('2026-09-26T12:00:00Z') });
    render(<LastUpdated at="2026-09-26T10:00:00Z" dataChangedAt="2026-09-19T10:00:00Z" intervalHours={24} />);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.queryByText('Stale')).toBeNull();
    expect(screen.getByTestId('last-updated').textContent).toMatch(
      /Checked 2 hours ago · no new data since Sep 19/,
    );
    vi.useRealTimers();
  });
});

describe('StatCard', () => {
  it('shows a semantic delta with arrow and sign', () => {
    render(
      <StatCard
        label="Unemployment"
        value={4.4}
        format="percent"
        delta={0.1}
        deltaFormat="pp_signed"
        goodDirection="down"
      />,
    );
    const d = screen.getByText('+0.10 pp').closest('[data-tone]');
    expect(d).toHaveAttribute('data-tone', 'bad');
    expect(d?.textContent).toContain('▲');
  });
});
