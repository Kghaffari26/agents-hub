import type { MacroLatest } from '@/lib/schemas/macro';

const ORDER = [
  { key: 'inflation', label: 'Inflation' },
  { key: 'labor', label: 'Labor' },
  { key: 'growth', label: 'Growth' },
  { key: 'policy', label: 'Policy' },
  { key: 'curve', label: 'Curve' },
] as const;

/** Five compact regime chips from the agent's deterministic labels (SPEC_MACRO §5.4). */
export function RegimeStrip({ regimes }: { regimes: MacroLatest['regimes'] }) {
  return (
    <section aria-labelledby="regimes-title" data-testid="regime-strip">
      <h2 id="regimes-title" className="sr-only">
        Current regimes
      </h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {ORDER.map(({ key, label }) => {
          const r = regimes[key];
          return (
            <li key={key} className="card min-w-0 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
              <p className="text-sm">
                <span className="font-semibold">{r.label}</span>
                <span className="text-muted" aria-hidden>
                  {' · '}
                </span>
                <span className="sr-only">: </span>
                <span className="num text-muted">{r.detail}</span>
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
