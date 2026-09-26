import { resolveRegistry } from '@/lib/metrics';
import type { RealEstateLatest } from '@/lib/schemas/realEstate';
import { Methodology } from '../common/Methodology';

export function REMethodology({ index }: { index: Pick<RealEstateLatest, 'metric_registry' | 'sources'> }) {
  const metrics = resolveRegistry(index.metric_registry);
  return (
    <Methodology>
      <h3>Metrics</h3>
      <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">
        {metrics.map((m) => (
          <div key={m.key}>
            <dt className="font-medium text-text">{m.label}</dt>
            <dd>{m.definition}</dd>
          </div>
        ))}
      </dl>
      <h3>Changes</h3>
      <p>
        Levels (prices, counts) change as a percent year over year. Shares and ratios (price drops,
        sale-to-list) change in
        <strong> percentage points</strong> — never a percent of a percent. Days on market and months of
        supply change as a difference. Permits use rolling 12-month sums because monthly permits are noisy.
      </p>
      <h3>Data lag</h3>
      <p>
        Redfin and Zillow publish monthly (about a month behind); Freddie Mac mortgage rates are weekly
        (Thursdays); Census permits are monthly.
      </p>
      <h3>Market temperature</h3>
      <p>
        Six components — sale-to-list, share sold above list, share off market in two weeks (higher = hotter),
        and days on market, price-drop share, months of supply (higher = cooler) — are z-scored across the
        tracked metros. The mean (at least four of six required) maps to 0–100 through the normal CDF: ≥80
        Hot, 60–79 Warm, 40–59 Balanced, 20–39 Cool, &lt;20 Cold. It is <strong>relative</strong> to the other
        metros. Market type is absolute: under 3 months of supply is a seller&apos;s market, over 6 a
        buyer&apos;s market. The U.S. figure compares the national series with its own 3-year history.
      </p>
      <h3>Affordability</h3>
      <p>
        Standard amortization, M = P·r(1+r)<sup>n</sup> / ((1+r)<sup>n</sup> − 1), with r the monthly rate.
        Defaults: 20% down, 30 years, the latest 30-year rate. Income needed assumes housing costs at 28% of
        gross income.
      </p>
      <h3>Attribution</h3>
      <ul className="list-disc pl-5">
        {index.sources.map((s) => (
          <li key={s.name}>
            <a className="link" href={s.url}>
              {s.name}
            </a>
            {s.attribution && <> — {s.attribution}</>}
          </li>
        ))}
      </ul>
    </Methodology>
  );
}
