import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import allFixture from '../../fixtures/grants/all.json';
import latestFixture from '../../fixtures/grants/latest.json';
import { grantsAll, grantsLatest } from '@/lib/schemas/grants';
import { daysLeft } from '@/components/grants/grantsFilters';

vi.mock('@/lib/csv', async (orig) => {
  const actual = await orig<typeof import('@/lib/csv')>();
  return { ...actual, downloadCsv: vi.fn() };
});

import { downloadCsv } from '@/lib/csv';
import { GrantsTableView } from '@/components/grants/GrantsTable';

const rows = grantsAll.parse(allFixture).rows;
const latest = grantsLatest.parse(latestFixture);
const NOW = new Date('2026-09-26T14:00:00Z');

function renderTable() {
  return render(<GrantsTableView rows={rows} topMatches={latest.top_matches} now={NOW} />);
}

const bodyRows = () => screen.getAllByTestId('grants-row');
const header = (name: string) =>
  screen.getAllByRole('columnheader').find((th) => th.textContent?.trim() === name)!;

describe('GrantsTableView', () => {
  beforeEach(() => vi.mocked(downloadCsv).mockClear());

  it('paginates 25 rows per page', async () => {
    renderTable();
    expect(screen.getByTestId('grants-table')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(25);
    const pages = Math.ceil(rows.length / 25);
    expect(screen.getByText(`Page 1 of ${pages} · ${rows.length} rows`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText(`Page 2 of ${pages} · ${rows.length} rows`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous page/i })).toBeEnabled();
  });

  it('filters by closing within + minimum fit via labelled inputs', async () => {
    renderTable();
    await userEvent.selectOptions(screen.getByLabelText('Closing within'), '14');
    fireEvent.change(screen.getByLabelText('Minimum fit'), { target: { value: '70' } });
    const expected = rows.filter((r) => {
      const d = daysLeft(r.deadline, NOW);
      return d != null && d >= 0 && d <= 14 && r.fit != null && r.fit >= 70;
    });
    expect(expected.length).toBeGreaterThan(0);
    expect(bodyRows()).toHaveLength(Math.min(25, expected.length));
    expect(screen.getByText(`Page 1 of 1 · ${expected.length} rows`)).toBeInTheDocument();
  });

  it('searches and new-only filter', async () => {
    renderTable();
    await userEvent.click(screen.getByLabelText('New only'));
    expect(bodyRows()).toHaveLength(Math.min(25, rows.filter((r) => r.is_new).length));
    await userEvent.type(screen.getByLabelText('Search'), 'zzzz-no-match');
    expect(screen.queryAllByTestId('grants-row')).toHaveLength(0);
    expect(screen.getByText('No rows match these filters')).toBeInTheDocument();
  });

  it('sorts when a header is clicked and updates aria-sort', async () => {
    renderTable();
    expect(header('Fit')).toHaveAttribute('aria-sort', 'descending');
    expect(header('Deadline')).toHaveAttribute('aria-sort', 'none');
    await userEvent.click(within(header('Deadline')).getByRole('button'));
    expect(header('Deadline')).toHaveAttribute('aria-sort', 'ascending');
    expect(header('Fit')).toHaveAttribute('aria-sort', 'none');
    const earliest = [...rows]
      .filter((r) => r.deadline)
      .sort((a, b) => +new Date(a.deadline!) - +new Date(b.deadline!))[0];
    expect(
      within(bodyRows()[0]).getByRole('link', { name: new RegExp(earliest.title.replace(/[().]/g, '\\$&')) }),
    ).toBeInTheDocument();
    await userEvent.click(within(header('Deadline')).getByRole('button'));
    expect(header('Deadline')).toHaveAttribute('aria-sort', 'descending');
  });

  it('expands a row to show reasons and the top-match summary', async () => {
    renderTable();
    const first = rows[0];
    await userEvent.click(within(bodyRows()[0]).getByRole('button', { name: /show details/i }));
    expect(
      screen.getByText(latest.top_matches.find((m) => m.id === first.id)!.summary!.what_they_want),
    ).toBeInTheDocument();
  });

  it('exports all filtered + sorted rows, not just the page', async () => {
    renderTable();
    await userEvent.click(screen.getByTestId('grants-export'));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [name, csv] = vi.mocked(downloadCsv).mock.calls[0];
    expect(name).toMatch(/^grants-matches-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.trimEnd().split('\r\n').length - 1).toBe(rows.length);

    vi.mocked(downloadCsv).mockClear();
    await userEvent.selectOptions(screen.getByLabelText('Closing within'), '14');
    fireEvent.change(screen.getByLabelText('Minimum fit'), { target: { value: '70' } });
    await userEvent.click(within(header('Deadline')).getByRole('button'));
    const visible = bodyRows();
    await userEvent.click(screen.getByTestId('grants-export'));
    const csv2 = vi.mocked(downloadCsv).mock.calls[0][1];
    const lines = csv2.trimEnd().split('\r\n').slice(1);
    expect(lines).toHaveLength(visible.length);
    // Same order as the visible rows.
    lines.forEach((line, i) => {
      const title = within(visible[i])
        .getAllByRole('link')[0]
        .textContent!.replace(/ \(opens.*$/, '');
      expect(line).toContain(title);
    });
  });
});
