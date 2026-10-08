import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { MetroSummary, RealEstateLatest } from '@/lib/schemas/realEstate';
import { alertFigure, shortName, sortAlertMetros } from './helpers';

const SHOWN = 4;

interface Entry {
  slug: string;
  name: string;
  figure: string | null;
  fullLabel: string | null;
  major: boolean;
}

function MetroLink({ e }: { e: Entry }) {
  return (
    <>
      <Link href={`/real-estate/${e.slug}/`} className="link" title={e.fullLabel ?? undefined}>
        {e.name}
      </Link>
      {e.figure && <span className="num text-muted"> {e.figure}</span>}
      {e.major && <span className="ml-1 text-xs font-semibold text-bad">major</span>}
    </>
  );
}

/**
 * Notable/major flags grouped by id across metros, each metro linked (SPEC_WEBSITE §7.2 item 4).
 * With real-estate 1.1.0 (`alerts[].metros`, SPEC_REAL_ESTATE §6.3) the group label is a threshold
 * and each metro shows its own figure, largest first; the rest are one click away.
 */
export function AlertsStrip({
  alerts,
  metros,
}: {
  alerts: RealEstateLatest['alerts'];
  metros: MetroSummary[];
}) {
  const shown = alerts.filter((a) => a.severity !== 'info' && a.slugs.length);
  if (!shown.length) return null;
  const nameOf = (slug: string) => shortName(metros.find((m) => m.slug === slug)?.name ?? slug);
  return (
    <section aria-labelledby="alerts-title">
      <h2 id="alerts-title" className="sr-only">
        Alerts
      </h2>
      <ul className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-start" data-testid="alerts-strip">
        {shown.map((a) => {
          const entries: Entry[] = a.metros?.length
            ? sortAlertMetros(a.metros).map((m) => ({
                slug: m.slug,
                name: shortName(m.name),
                figure: alertFigure(a.label, m.label),
                fullLabel: m.label,
                major: m.severity === 'major' && a.severity !== 'major',
              }))
            : a.slugs.map((s) => ({ slug: s, name: nameOf(s), figure: null, fullLabel: null, major: false }));
          const first = entries.slice(0, SHOWN);
          const rest = entries.slice(SHOWN);
          return (
            <li
              key={a.flag}
              data-flag={a.flag}
              className={`rounded-card border px-3 py-2 text-sm ${
                a.severity === 'major' ? 'border-bad/50 bg-bad/5' : 'border-neutral/40 bg-neutral/5'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <AlertTriangle
                  className={`h-4 w-4 ${a.severity === 'major' ? 'text-bad' : 'text-neutral'}`}
                  aria-hidden
                />
                <span className="font-semibold">
                  {a.severity === 'major' && <span className="text-bad">Major: </span>}
                  {a.label}:
                </span>
                {first.map((e, i) => (
                  <span key={e.slug} data-testid="alert-metro">
                    <MetroLink e={e} />
                    {i < first.length - 1 ? ',' : ''}
                  </span>
                ))}
              </div>
              {rest.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer select-none text-muted hover:text-text">
                    +{rest.length} more
                    <span className="sr-only"> for {a.label}</span>
                  </summary>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {rest.map((e) => (
                      <li key={e.slug} data-testid="alert-metro">
                        <MetroLink e={e} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
