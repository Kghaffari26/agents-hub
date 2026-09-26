import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { affordability, monthlyPayment, roundCents } from '@/lib/mortgage';

describe('monthlyPayment', () => {
  it('matches the known example to the cent: $400,000 at 6.5% for 30 years', () => {
    expect(roundCents(monthlyPayment(400_000, 6.5, 30))).toBe(2528.27);
  });
  it('other known vectors', () => {
    expect(roundCents(monthlyPayment(200_000, 5, 15))).toBe(1581.59);
    expect(roundCents(monthlyPayment(100_000, 3, 30))).toBe(421.6);
  });
  it('r = 0 → P/n', () => {
    expect(monthlyPayment(360_000, 0, 30)).toBe(1000);
  });
  it('degenerate input → 0', () => {
    expect(monthlyPayment(0, 6, 30)).toBe(0);
    expect(monthlyPayment(100, 6, 0)).toBe(0);
  });
  it('reproduces the agent’s payment_now with default inputs (shared vectors)', () => {
    const d = JSON.parse(readFileSync('test/fixtures/real_estate/metros/austin-tx.json', 'utf8'));
    const price = d.latest.median_sale_price.value;
    const a = d.affordability;
    expect(roundCents(monthlyPayment(price * 0.8, a.assumptions.rate_now, 30))).toBe(a.payment_now);
    expect(
      roundCents(monthlyPayment(a.assumptions.price_year_ago * 0.8, a.assumptions.rate_year_ago, 30)),
    ).toBe(a.payment_year_ago);
  });
});

describe('affordability', () => {
  it('breaks down the monthly payment and income needed at 28%', () => {
    const o = affordability({
      price: 500_000,
      downPct: 20,
      ratePct: 6.5,
      termYears: 30,
      propertyTaxPct: 1.2,
      insuranceYear: 1800,
      hoaMonth: 100,
    });
    expect(o.loan).toBe(400_000);
    expect(o.principalInterest).toBe(2528.27);
    expect(o.tax).toBe(500);
    expect(o.insurance).toBe(150);
    expect(o.total).toBe(3278.27);
    expect(o.incomeNeeded).toBe(Math.round((3278.27 * 12) / 0.28));
  });
  it('clamps silly inputs', () => {
    const o = affordability({
      price: -5,
      downPct: 150,
      ratePct: -1,
      termYears: 30,
      propertyTaxPct: -1,
      insuranceYear: -1,
      hoaMonth: -1,
    });
    expect(o.total).toBe(0);
  });
});
