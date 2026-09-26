'use client';

import type { MetroDetail } from '@/lib/schemas/realEstate';
import { METRICS } from '@/lib/metrics';
import { shortName } from './helpers';

const LABEL_STYLE: Record<string, string> = {
  Hot: 'border-bad/50 text-bad',
  Warm: 'border-[color:var(--chart-2)] text-[color:var(--neutral)]',
  Balanced: 'border-border text-text',
  Cool: 'border-accent/50 text-accent',
  Cold: 'border-accent text-accent',
};

const SIGN: Record<string, string> = {
  avg_sale_to_list: '+',
  sold_above_list: '+',
  off_market_in_two_weeks: '+',
  median_dom: '−',
  price_drops: '−',
  months_of_supply: '−',
};

/** Temperature label + score, with an explainer of the z-scored components (SPEC_REAL_ESTATE §5.3). */
export function TemperatureBadge({
  name,
  temperature,
  marketType,
}: {
  name: string;
  temperature: { score: number | null; label: string | null; components?: Record<string, number | null> };
  marketType?: string | null;
}) {
  const comps = Object.entries(temperature.components ?? {});
  return (
    <details className="card group p-3" data-testid="temperature">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-medium">{shortName(name)}</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${LABEL_STYLE[temperature.label ?? ''] ?? 'border-border'}`}
        >
          {temperature.label ?? 'n/a'}
          {temperature.score != null && <span className="num"> · {temperature.score}/100</span>}
        </span>
        {marketType && <span className="text-xs text-muted">{marketType}</span>}
        <span className="ml-auto text-xs text-accent underline decoration-dotted group-open:hidden">
          Why?
        </span>
      </summary>
      <div className="mt-2 text-xs text-muted">
        <p>
          How competitive this market is{' '}
          <strong className="text-text">relative to the other tracked metros</strong>: the average of six
          z-scores, mapped to 0–100.
        </p>
        {comps.length > 0 && (
          <ul className="num mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {comps.map(([k, z]) => (
              <li key={k} className="flex justify-between gap-2">
                <span>
                  {SIGN[k] ?? ''} {METRICS[k]?.short ?? k}
                </span>
                <span className={z == null ? '' : z > 0 ? 'text-good' : 'text-bad'}>
                  {z == null ? '—' : `${z > 0 ? '+' : z < 0 ? '−' : ''}${Math.abs(z).toFixed(1)}σ`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export function TemperatureRow({
  slugs,
  details,
}: {
  slugs: string[];
  details: Record<string, MetroDetail | undefined>;
}) {
  const shown = slugs.map((s) => details[s]).filter((d): d is MetroDetail => !!d);
  if (!shown.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Market temperature">
      {shown.map((d) => (
        <TemperatureBadge key={d.slug} name={d.name} temperature={d.temperature} marketType={d.market_type} />
      ))}
    </div>
  );
}
