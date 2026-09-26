/** Mortgage math (SPEC_WEBSITE §7.2, SPEC_REAL_ESTATE §5.2). */

/** Monthly principal & interest: M = P·r(1+r)^n / ((1+r)^n − 1); when r = 0, M = P/n. */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (!(principal > 0) || n <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  const f = Math.pow(1 + r, n);
  return (principal * r * f) / (f - 1);
}

export const roundCents = (x: number) => Math.round(x * 100) / 100;

export interface AffordabilityInput {
  price: number;
  downPct: number; // 0–100
  ratePct: number;
  termYears: 15 | 30 | number;
  propertyTaxPct: number; // annual, % of price
  insuranceYear: number;
  hoaMonth: number;
}

export interface AffordabilityOutput {
  loan: number;
  principalInterest: number;
  tax: number;
  insurance: number;
  hoa: number;
  total: number;
  /** Gross annual income needed at a 28% front-end ratio. */
  incomeNeeded: number;
}

export const FRONT_END_RATIO = 0.28;

export function affordability(i: AffordabilityInput): AffordabilityOutput {
  const price = Math.max(0, i.price || 0);
  const down = Math.min(100, Math.max(0, i.downPct || 0));
  const loan = price * (1 - down / 100);
  const principalInterest = monthlyPayment(loan, Math.max(0, i.ratePct || 0), i.termYears);
  const tax = (price * Math.max(0, i.propertyTaxPct || 0)) / 100 / 12;
  const insurance = Math.max(0, i.insuranceYear || 0) / 12;
  const hoa = Math.max(0, i.hoaMonth || 0);
  const total = principalInterest + tax + insurance + hoa;
  return {
    loan,
    principalInterest: roundCents(principalInterest),
    tax: roundCents(tax),
    insurance: roundCents(insurance),
    hoa: roundCents(hoa),
    total: roundCents(total),
    incomeNeeded: Math.round((total * 12) / FRONT_END_RATIO),
  };
}
