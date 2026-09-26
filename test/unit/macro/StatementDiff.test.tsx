import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { macroLatest } from '@/lib/schemas/macro';
import { StatementDiff, diffParagraphs, splitParagraphs } from '@/components/macro/StatementDiff';

const data = macroLatest.parse(
  JSON.parse(readFileSync(path.resolve(__dirname, '../../fixtures/macro/latest.json'), 'utf8')),
);
const latest = data.fomc.latest!;

function mockMatchMedia(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width: 768px') ? wide : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderDiff(props: Partial<Parameters<typeof StatementDiff>[0]> = {}) {
  return render(
    <StatementDiff
      previousText={latest.previous_text}
      latestText={latest.latest_text}
      previousDate={latest.previous_date}
      latestDate={latest.date}
      changes={latest.changes}
      citedChangeIdx={latest.read?.cited_change_idx}
      {...props}
    />,
  );
}

describe('diff helpers', () => {
  it('splits paragraphs on blank lines and pairs them by index', () => {
    expect(splitParagraphs('a\n\nb\n\n\nc')).toEqual(['a', 'b', 'c']);
    const blocks = diffParagraphs('one\n\nsame', 'one two\n\nsame\n\nnew');
    expect(blocks.map((b) => b.kind)).toEqual(['changed', 'same', 'changed']);
  });
});

describe('StatementDiff', () => {
  beforeAll(() => mockMatchMedia(true));

  it('renders additions in <ins> and deletions in <del>', () => {
    const { container } = renderDiff();
    const diff = container.querySelector('[data-mode]')!;
    const ins = Array.from(diff.querySelectorAll('ins')).map((e) => e.textContent);
    const del = Array.from(diff.querySelectorAll('del')).map((e) => e.textContent);
    expect(ins.join(' ')).toMatch(/lower/);
    expect(del.join(' ')).toMatch(/maintain/);
    expect(ins.join(' ')).toMatch(/downside risks to employment have risen/);
  });

  it('collapses unchanged paragraphs behind a button that expands them', () => {
    renderDiff();
    const btn = screen.getByRole('button', { name: /Show 1 unchanged paragraph/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/In assessing the appropriate stance of monetary policy/)).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: /Hide 1 unchanged paragraph/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText(/In assessing the appropriate stance of monetary policy/)).toBeInTheDocument();
  });

  it('renders the key edits list from the agent changes', () => {
    renderDiff();
    const list = screen.getByTestId('key-edits');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(latest.changes.length);
    expect(within(items[0]).getByText('Modified')).toBeInTheDocument();
    expect(within(list).getAllByText('Cited in the read')).toHaveLength(latest.read!.cited_change_idx.length);
  });

  it('toggles side-by-side mode on wide screens', () => {
    const { container } = renderDiff();
    const diff = () => container.querySelector('[data-mode]')!;
    expect(diff()).toHaveAttribute('data-mode', 'inline');
    const side = screen.getByRole('button', { name: 'Side by side' });
    fireEvent.click(side);
    expect(side).toHaveAttribute('aria-pressed', 'true');
    expect(diff()).toHaveAttribute('data-mode', 'side');
    // Side by side: the previous column shows deletions only, the latest column additions only.
    const firstRow = diff().querySelector('.grid')!;
    const [before, after] = Array.from(firstRow.children);
    expect(before.querySelector('ins')).toBeNull();
    expect(before.querySelector('del')).not.toBeNull();
    expect(after.querySelector('del')).toBeNull();
    expect(after.querySelector('ins')).not.toBeNull();
  });

  it('is inline-only on narrow screens', () => {
    mockMatchMedia(false);
    renderDiff();
    expect(screen.queryByRole('button', { name: 'Side by side' })).toBeNull();
    mockMatchMedia(true);
  });

  it('handles a missing previous statement', () => {
    renderDiff({ previousText: null });
    expect(screen.getByText('No previous statement to compare.')).toBeInTheDocument();
  });
});
