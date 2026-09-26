import type { RealEstateLatest } from '@/lib/schemas/realEstate';
import { StatCard } from '../common/StatCard';

/** National stat cards (SPEC_WEBSITE §7.2 item 2). */
export function NationalStrip({ national }: { national: RealEstateLatest['national'] }) {
  const L = national.latest;
  const s = national.series;
  const tail = (k: string) => (s[k] ?? []).slice(-24);
  const rates = national.rates;
  const hs = national.construction.housing_starts;
  return (
    <section
      aria-label="National housing market"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <StatCard
        label="US median sale price"
        value={L.median_sale_price?.value}
        format="currency"
        delta={L.median_sale_price?.yoy ?? null}
        deltaFormat="percent_signed"
        deltaLabel="YoY"
        goodDirection="neutral"
        sparkline={tail('median_sale_price')}
      />
      <StatCard
        label="Active inventory"
        value={L.inventory?.value}
        format="count"
        delta={L.inventory?.yoy ?? null}
        deltaFormat="percent_signed"
        deltaLabel="YoY"
        goodDirection="neutral"
        sparkline={tail('inventory')}
      />
      <StatCard
        label="Median days on market"
        value={L.median_dom?.value}
        format="days"
        delta={L.median_dom?.yoy ?? null}
        deltaFormat="days"
        deltaLabel="YoY"
        goodDirection="neutral"
        sparkline={tail('median_dom')}
      />
      <StatCard
        label="Listings with price drops"
        value={L.price_drops?.value}
        format="percent"
        opts={{ isRatio: true }}
        delta={L.price_drops?.yoy ?? null}
        deltaFormat="pp_signed"
        deltaLabel="YoY"
        goodDirection="neutral"
        sparkline={tail('price_drops')}
      />
      <StatCard
        label="30-yr mortgage rate"
        value={rates.latest.mortgage30}
        format="percent"
        delta={rates.latest.mortgage30_change_1w_pp}
        deltaFormat="pp_signed"
        deltaLabel="vs last week"
        goodDirection="neutral"
        sparkline={rates.mortgage30.slice(-52)}
      />
      <StatCard
        label="Housing starts (SAAR)"
        value={hs.value != null ? hs.value * 1000 : null}
        format="count"
        delta={hs.mom ?? null}
        deltaFormat="percent_signed"
        deltaLabel="MoM"
        goodDirection="neutral"
        sparkline={(national.construction.series.housing_starts ?? []).slice(-24)}
      />
    </section>
  );
}
