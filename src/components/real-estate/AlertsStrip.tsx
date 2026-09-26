import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { MetroSummary, RealEstateLatest } from '@/lib/schemas/realEstate';
import { shortName } from './helpers';

/** Notable/major flags grouped by id across metros, each metro linked (SPEC_WEBSITE §7.2 item 4). */
export function AlertsStrip({
  alerts,
  metros,
}: {
  alerts: RealEstateLatest['alerts'];
  metros: MetroSummary[];
}) {
  const shown = alerts.filter((a) => a.severity !== 'info' && a.slugs.length);
  if (!shown.length) return null;
  const name = (slug: string) => shortName(metros.find((m) => m.slug === slug)?.name ?? slug);
  return (
    <section aria-labelledby="alerts-title">
      <h2 id="alerts-title" className="sr-only">
        Alerts
      </h2>
      <ul className="flex flex-col gap-2 md:flex-row md:flex-wrap" data-testid="alerts-strip">
        {shown.map((a) => (
          <li
            key={a.flag}
            className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-card border px-3 py-2 text-sm ${
              a.severity === 'major' ? 'border-bad/50 bg-bad/5' : 'border-neutral/40 bg-neutral/5'
            }`}
          >
            <AlertTriangle
              className={`h-4 w-4 ${a.severity === 'major' ? 'text-bad' : 'text-neutral'}`}
              aria-hidden
            />
            <span className="font-semibold">{a.label}:</span>
            {a.slugs.slice(0, 4).map((s, i) => (
              <span key={s}>
                <Link href={`/real-estate/${s}/`} className="link">
                  {name(s)}
                </Link>
                {i < Math.min(a.slugs.length, 4) - 1 ? ',' : ''}
              </span>
            ))}
            {a.slugs.length > 4 && <span className="text-muted">+{a.slugs.length - 4} more</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
