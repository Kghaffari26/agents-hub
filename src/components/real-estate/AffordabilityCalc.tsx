'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { MetroDetail, MetroSummary } from '@/lib/schemas/realEstate';
import { affordability, monthlyPayment, roundCents } from '@/lib/mortgage';
import { currency, percentSigned, ratioPercent } from '@/lib/format';
import { useJson } from '@/lib/data/client';
import { metroDetail } from '@/lib/schemas/realEstate';
import { useThemeColors } from '@/lib/hooks';

export interface CalcDefaults {
  rate: number;
  propertyTaxPct?: number;
  insuranceYear?: number;
  hoaMonth?: number;
  downPct?: number;
}

function money(x: number) {
  return currency(x, true);
}

/**
 * Affordability calculator (SPEC_WEBSITE §7.2). Pure presentation over `detail`; the
 * wrapper below lazy-loads the chosen metro's file.
 */
export function AffordabilityView({
  metros,
  metroSlug,
  onMetroChange,
  detail,
  defaults,
}: {
  metros: Pick<MetroSummary, 'slug' | 'name'>[];
  metroSlug: string;
  onMetroChange: (slug: string) => void;
  detail?: MetroDetail;
  defaults: CalcDefaults;
}) {
  const id = useId();
  const c = useThemeColors();
  const median = detail?.latest.median_sale_price?.value ?? null;
  const [price, setPrice] = useState<number>(median ?? 400000);
  const [down, setDown] = useState(defaults.downPct ?? 20);
  const [rate, setRate] = useState(defaults.rate);
  const [term, setTerm] = useState<15 | 30>(30);
  const [tax, setTax] = useState(defaults.propertyTaxPct ?? 1.1);
  const [ins, setIns] = useState(defaults.insuranceYear ?? 1800);
  const [hoa, setHoa] = useState(defaults.hoaMonth ?? 0);

  // A new metro resets the price to that metro's median — unless the user already typed one.
  const applied = useRef<string | null>(null);
  const touched = useRef(false);
  const lastSlug = useRef(metroSlug);
  useEffect(() => {
    if (lastSlug.current !== metroSlug) {
      lastSlug.current = metroSlug;
      touched.current = false; // switching metros resets the price
    }
    if (median != null && applied.current !== metroSlug) {
      applied.current = metroSlug;
      if (!touched.current) setPrice(median);
    }
  }, [median, metroSlug]);

  const out = useMemo(
    () =>
      affordability({
        price,
        downPct: down,
        ratePct: rate,
        termYears: term,
        propertyTaxPct: tax,
        insuranceYear: ins,
        hoaMonth: hoa,
      }),
    [price, down, rate, term, tax, ins, hoa],
  );
  const income = detail?.affordability.median_household_income ?? null;
  const pctIncome = income ? (out.total * 12) / income : null;
  const a = detail?.affordability.assumptions;
  const thenPI =
    a?.price_year_ago != null && a.rate_year_ago != null
      ? roundCents(monthlyPayment(a.price_year_ago * (1 - down / 100), a.rate_year_ago, term))
      : null;
  const nowPI = median != null ? roundCents(monthlyPayment(median * (1 - down / 100), rate, term)) : null;

  const parts = [
    { key: 'Principal & interest', v: out.principalInterest, color: c['chart-1'] },
    { key: 'Property tax', v: out.tax, color: c['chart-2'] },
    { key: 'Insurance', v: out.insurance, color: c['chart-3'] },
    { key: 'HOA', v: out.hoa, color: c['chart-4'] },
  ];
  const num = (set: (n: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value);
    set(Number.isFinite(n) ? n : 0);
  };

  return (
    <section aria-labelledby={`${id}-title`} className="card p-4 md:p-5" data-testid="affordability">
      <h2 id={`${id}-title`} className="section-title">
        Affordability calculator
      </h2>
      <p className="mb-4 text-sm text-muted">An estimate for planning, not financial advice.</p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Metro
            <select className="input" value={metroSlug} onChange={(e) => onMetroChange(e.target.value)}>
              {metros.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Home price ($)
            <input
              className="input num"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={price}
              onChange={num((n) => {
                touched.current = true;
                setPrice(n);
              })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Interest rate (%)
            <input
              className="input num"
              type="number"
              min={0}
              max={20}
              step={0.01}
              inputMode="decimal"
              value={rate}
              onChange={num(setRate)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span>
              Down payment: <strong className="num">{down}%</strong>{' '}
              <span className="num text-muted">({currency((price * down) / 100)})</span>
            </span>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={down}
              onChange={num(setDown)}
              aria-valuetext={`${down} percent`}
            />
          </label>
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="mb-1">Term</legend>
            <div className="flex gap-3">
              {[30, 15].map((t) => (
                <label key={t} className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`${id}-term`}
                    checked={term === t}
                    onChange={() => setTerm(t as 15 | 30)}
                  />
                  {t} years
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            Property tax (% / yr)
            <input
              className="input num"
              type="number"
              min={0}
              step={0.05}
              inputMode="decimal"
              value={tax}
              onChange={num(setTax)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Insurance ($ / yr)
            <input
              className="input num"
              type="number"
              min={0}
              step={50}
              inputMode="numeric"
              value={ins}
              onChange={num(setIns)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            HOA ($ / mo)
            <input
              className="input num"
              type="number"
              min={0}
              step={10}
              inputMode="numeric"
              value={hoa}
              onChange={num(setHoa)}
            />
          </label>
        </form>

        <div className="space-y-4" aria-live="polite">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-card bg-surface-2 p-3">
              <p className="text-xs uppercase tracking-wide text-muted">Principal &amp; interest</p>
              <p className="num text-xl font-semibold" data-testid="calc-pi">
                {money(out.principalInterest)}
              </p>
            </div>
            <div className="rounded-card bg-surface-2 p-3">
              <p className="text-xs uppercase tracking-wide text-muted">Total monthly</p>
              <p className="num text-xl font-semibold" data-testid="calc-total">
                {money(out.total)}
              </p>
            </div>
          </div>
          <div>
            <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              {parts.map((p) => (
                <span
                  key={p.key}
                  style={{ width: `${out.total ? (p.v / out.total) * 100 : 0}%`, background: p.color }}
                />
              ))}
            </div>
            <ul className="num mt-2 space-y-1 text-sm">
              {parts.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
                    {p.key}
                  </span>
                  <span>{money(p.v)}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm">
            Income needed (28% of gross income):{' '}
            <strong className="num" data-testid="calc-income">
              {currency(out.incomeNeeded)}/yr
            </strong>
          </p>
          <p className="text-sm">
            As % of {detail?.name ?? 'metro'} median household income
            {detail?.affordability.income_year ? ` (${detail.affordability.income_year})` : ''}:{' '}
            <strong className="num">{pctIncome != null ? ratioPercent(pctIncome) : '—'}</strong>
            {income != null && <span className="num text-muted"> of {currency(income)}</span>}
          </p>
          <div className="rounded-card border border-border p-3 text-sm">
            <p className="font-medium">
              Then vs now (P&amp;I, {down}% down, {term}-yr)
            </p>
            <dl className="num mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              <dt className="text-muted">
                A year ago
                {a?.price_year_ago != null ? ` (${currency(a.price_year_ago)} at ${a.rate_year_ago}%)` : ''}
              </dt>
              <dd className="text-right">{thenPI != null ? money(thenPI) : '—'}</dd>
              <dt className="text-muted">Now ({median != null ? `${currency(median)} at ${rate}%` : '—'})</dt>
              <dd className="text-right">{nowPI != null ? money(nowPI) : '—'}</dd>
              <dt className="text-muted">Change</dt>
              <dd className="text-right">{thenPI && nowPI ? percentSigned(nowPI / thenPI - 1) : '—'}</dd>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AffordabilityCalc({
  metros,
  initialSlug,
  defaults,
}: {
  metros: Pick<MetroSummary, 'slug' | 'name'>[];
  initialSlug: string;
  defaults: CalcDefaults;
}) {
  const [slug, setSlug] = useState(initialSlug);
  useEffect(() => setSlug(initialSlug), [initialSlug]);
  const state = useJson(`real_estate/metros/${slug}.json`, metroDetail);
  return (
    <AffordabilityView
      metros={metros}
      metroSlug={slug}
      onMetroChange={setSlug}
      detail={state.status === 'ok' ? state.data : undefined}
      defaults={defaults}
    />
  );
}
