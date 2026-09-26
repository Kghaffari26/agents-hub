import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/grants/all.json';
import { grantsAll, type GrantsRow } from '@/lib/schemas/grants';
import {
  DEFAULT_FILTERS,
  csvFilename,
  daysLeft,
  filterRows,
  formatAgency,
  rowsToCsv,
  sortRows,
  type GrantsFilters,
} from '@/components/grants/grantsFilters';

const rows = grantsAll.parse(fixture).rows;
// Fixed clock so fixture deadlines (late Sep – Nov 2026) are deterministic.
const NOW = new Date('2026-09-26T14:00:00Z');
const f = (patch: Partial<GrantsFilters>): GrantsFilters => ({ ...DEFAULT_FILTERS, ...patch });

/** Minimal RFC 4180 parser for round-trip checks. */
function parseCsv(s: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r' && s[i + 1] === '\n') {
      row.push(field);
      out.push(row);
      row = [];
      field = '';
      i++;
    } else field += c;
  }
  return out;
}

describe('filterRows', () => {
  it('returns everything with default filters', () => {
    expect(filterRows(rows, DEFAULT_FILTERS, NOW)).toHaveLength(rows.length);
  });

  it('filters by closing within 14 days plus min fit 70', () => {
    const out = filterRows(rows, f({ closingWithin: 14, minFit: 70 }), NOW);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(rows.length);
    for (const r of out) {
      const d = daysLeft(r.deadline, NOW)!;
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(14);
      expect(r.fit).not.toBeNull();
      expect(r.fit!).toBeGreaterThanOrEqual(70);
    }
    // Nothing that qualifies is dropped.
    const expected = rows.filter((r) => {
      const d = daysLeft(r.deadline, NOW);
      return d != null && d >= 0 && d <= 14 && r.fit != null && r.fit >= 70;
    });
    expect(out.map((r) => r.id)).toEqual(expected.map((r) => r.id));
  });

  it('excludes unscored rows once a minimum fit is set', () => {
    expect(filterRows(rows, f({ minFit: 1 }), NOW).every((r) => r.fit != null)).toBe(true);
  });

  it('new only', () => {
    const out = filterRows(rows, f({ newOnly: true }), NOW);
    expect(out.length).toBe(rows.filter((r) => r.is_new).length);
    expect(out.every((r) => r.is_new)).toBe(true);
  });

  it('text search matches title or agency, case-insensitive', () => {
    const byTitle = filterRows(rows, f({ q: 'CLOUD' }), NOW);
    expect(byTitle.length).toBeGreaterThan(0);
    expect(byTitle.every((r) => /cloud/i.test(r.title) || /cloud/i.test(r.agency))).toBe(true);
    const byAgency = filterRows(rows, f({ q: 'veterans' }), NOW);
    expect(byAgency.length).toBeGreaterThan(0);
    expect(byAgency.every((r) => /veterans/i.test(r.agency) || /veterans/i.test(r.title))).toBe(true);
    // The formatted agency name is searchable too.
    expect(filterRows(rows, f({ q: 'department of veterans' }), NOW).length).toBe(
      rows.filter((r) => r.agency === 'VETERANS AFFAIRS, DEPARTMENT OF').length,
    );
  });

  it('agency multi-select', () => {
    const agencies = ['COMMERCE, DEPARTMENT OF', 'ENERGY, DEPARTMENT OF'];
    const out = filterRows(rows, f({ agencies }), NOW);
    expect(out.length).toBe(rows.filter((r) => agencies.includes(r.agency)).length);
    expect(new Set(out.map((r) => r.agency))).toEqual(new Set(agencies));
  });

  it('source, type, set-aside and NAICS', () => {
    expect(filterRows(rows, f({ source: 'grants_gov' }), NOW).every((r) => r.source === 'grants_gov')).toBe(
      true,
    );
    expect(
      filterRows(rows, f({ type: 'Sources Sought' }), NOW).every((r) => r.type === 'Sources Sought'),
    ).toBe(true);
    expect(filterRows(rows, f({ setAside: '__none__' }), NOW).every((r) => r.set_aside == null)).toBe(true);
    expect(filterRows(rows, f({ naics: '541511' }), NOW).every((r) => r.naics.includes('541511'))).toBe(true);
  });
});

describe('sortRows', () => {
  it('sorts by deadline ascending with missing deadlines last', () => {
    const withNull: GrantsRow[] = [{ ...rows[0], id: 'x', deadline: null }, ...rows];
    const out = sortRows(withNull, { key: 'deadline', desc: false });
    const times = out.filter((r) => r.deadline).map((r) => new Date(r.deadline!).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(out.at(-1)!.id).toBe('x');
  });

  it('puts null fits last in both directions', () => {
    for (const desc of [true, false]) {
      const out = sortRows(rows, { key: 'fit', desc });
      const firstNull = out.findIndex((r) => r.fit == null);
      expect(firstNull).toBeGreaterThan(0);
      expect(out.slice(firstNull).every((r) => r.fit == null)).toBe(true);
      const fits = out.slice(0, firstNull).map((r) => r.fit!);
      expect(fits).toEqual([...fits].sort((a, b) => (desc ? b - a : a - b)));
    }
  });

  it('does not mutate its input', () => {
    const copy = [...rows];
    sortRows(rows, { key: 'title', desc: false });
    expect(rows).toEqual(copy);
  });
});

describe('rowsToCsv', () => {
  it('exports exactly the filtered + sorted rows (acceptance flow)', () => {
    const visible = sortRows(filterRows(rows, f({ closingWithin: 14, minFit: 70 }), NOW), {
      key: 'deadline',
      desc: false,
    });
    const csv = rowsToCsv(visible);
    expect(csv.endsWith('\r\n')).toBe(true);
    const parsed = parseCsv(csv);
    expect(parsed[0]).toEqual([
      'Fit',
      'Title',
      'Agency',
      'Source',
      'Type',
      'NAICS',
      'Set-aside',
      'Posted',
      'Deadline',
      'Value',
      'URL',
    ]);
    expect(parsed).toHaveLength(visible.length + 1);
    parsed.slice(1).forEach((line, i) => {
      expect(line[1]).toBe(visible[i].title);
      expect(line[0]).toBe(String(visible[i].fit));
      expect(line[8]).toBe(visible[i].deadline);
      expect(line[10]).toBe(visible[i].url);
    });
  });

  it('applies RFC 4180 quoting', () => {
    const row: GrantsRow = {
      ...rows[0],
      title: 'Data "lake", phase 2\nplus support',
      agency: 'VETERANS AFFAIRS, DEPARTMENT OF',
      value: null,
      set_aside: null,
    };
    const csv = rowsToCsv([row]);
    expect(csv).toContain('"Data ""lake"", phase 2\nplus support"');
    expect(csv).toContain(',Department of Veterans Affairs,');
    const parsed = parseCsv(csv);
    expect(parsed[1][1]).toBe(row.title);
    expect(parsed[1][6]).toBe('');
    expect(parsed[1][9]).toBe('');
  });

  it('filename carries the date', () => {
    expect(csvFilename(new Date(2026, 8, 26, 10))).toBe('grants-matches-2026-09-26.csv');
  });
});

describe('formatAgency', () => {
  it('reorders SAM "X, DEPARTMENT OF" names and title-cases', () => {
    expect(formatAgency('VETERANS AFFAIRS, DEPARTMENT OF')).toBe('Department of Veterans Affairs');
    expect(formatAgency('INTERIOR, DEPARTMENT OF THE')).toBe('Department of the Interior');
    expect(formatAgency('HEALTH AND HUMAN SERVICES, DEPARTMENT OF')).toBe(
      'Department of Health and Human Services',
    );
    expect(formatAgency('GENERAL SERVICES ADMINISTRATION')).toBe('General Services Administration');
    expect(formatAgency(null)).toBe('—');
  });
});
