import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { realEstateLatest } from '@/lib/schemas/realEstate';
import * as allSchemas from '@/lib/schemas';
import { AlertsStrip } from '@/components/real-estate/AlertsStrip';
import { alertFigure, sortAlertMetros } from '@/components/real-estate/helpers';
import { agenticWarnings } from '../../../scripts/lib/contracts.mjs';

const raw = () => JSON.parse(readFileSync('test/fixtures/real_estate/latest.json', 'utf8'));

describe('alert figures (real-estate 1.1.0 alerts[].metros)', () => {
  it('strips the words shared with the threshold label', () => {
    expect(alertFigure('Inventory down ≥20% YoY', 'Inventory -24% YoY')).toBe('−24% YoY');
    expect(alertFigure('Prices down ≥3% YoY', 'Prices -4.4% YoY')).toBe('−4.4% YoY');
    expect(alertFigure('Days on market up', 'Slower sales +13 days')).toBe('Slower sales +13 days');
    // never strips the whole label
    expect(alertFigure('Rent outpacing home values', 'Rent outpacing home values')).toBe('values');
  });
  it('sorts major first, then by the largest absolute figure', () => {
    const out = sortAlertMetros([
      { slug: 'a', severity: 'notable' as const, value: -0.2 },
      { slug: 'b', severity: 'notable' as const, value: -0.3 },
      { slug: 'c', severity: 'major' as const, value: 0.1 },
      { slug: 'd', severity: 'notable' as const, value: null },
    ]);
    expect(out.map((x) => x.slug)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('renders each metro with its own figure, the rest behind "+N more"', () => {
    const idx = realEstateLatest.parse(raw());
    render(<AlertsStrip alerts={idx.alerts} metros={idx.metros} />);
    const item = screen
      .getByTestId('alerts-strip')
      .querySelector('[data-flag="inventory_surge"]') as HTMLElement;
    expect(item).toHaveTextContent('Inventory up ≥25% YoY:');
    const group = idx.alerts.find((a) => a.flag === 'inventory_surge')!;
    const top = sortAlertMetros(group.metros!)[0];
    const first = within(item).getAllByTestId('alert-metro')[0];
    expect(first).toHaveTextContent(alertFigure(group.label, top.label));
    expect(within(first).getByRole('link').getAttribute('href')).toContain(`/real-estate/${top.slug}`);
    fireEvent.click(within(item).getByText(`+${group.metros!.length - 4} more`));
    expect(within(item).getAllByTestId('alert-metro')).toHaveLength(group.metros!.length);
  });

  it('marks a major metro inside a notable group in words', () => {
    const idx = realEstateLatest.parse(raw());
    idx.alerts[0].metros![2].severity = 'major';
    render(<AlertsStrip alerts={idx.alerts} metros={idx.metros} />);
    const first = within(screen.getByTestId('alerts-strip')).getAllByTestId('alert-metro')[0];
    expect(first).toHaveTextContent('major');
  });

  it('older data (no metros) still lists the slugs', () => {
    const d = raw();
    for (const a of d.alerts) delete a.metros;
    const idx = realEstateLatest.parse(d);
    render(<AlertsStrip alerts={idx.alerts} metros={idx.metros} />);
    const first = within(screen.getByTestId('alerts-strip')).getAllByTestId('alert-metro')[0];
    expect(first.textContent).toBe(
      `${idx.metros.find((m) => m.slug === idx.alerts[0].slugs[0])!.name.split(',')[0]},`,
    );
  });

  it('a malformed metro entry is dropped, with a fetch-data warning', () => {
    const d = raw();
    d.alerts[0].metros[1].label = 5;
    const idx = realEstateLatest.parse(d);
    expect(idx.alerts[0].metros).toHaveLength(d.alerts[0].metros.length - 1);
    expect(agenticWarnings(allSchemas, 'real_estate', 'latest.json', d)[0]).toMatch(/alerts\.0\.metros/);
    expect(agenticWarnings(allSchemas, 'real_estate', 'latest.json', raw())).toEqual([]);
  });
});
