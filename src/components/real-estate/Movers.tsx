import Link from 'next/link';
import type { RealEstateLatest } from '@/lib/schemas/realEstate';
import { Delta } from '../common/Delta';

const LISTS = [
  { key: 'price_gains', title: 'Biggest price gains YoY' },
  { key: 'price_declines', title: 'Biggest price declines YoY' },
  { key: 'inventory_growth', title: 'Fastest-growing inventory' },
] as const;

/** Top-5 movers lists, each linking to its metro (SPEC_WEBSITE §7.2 item 7). */
export function Movers({ movers }: { movers: RealEstateLatest['movers'] }) {
  return (
    <section aria-labelledby="movers-title">
      <h2 id="movers-title" className="section-title mb-3">
        Movers
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        {LISTS.map(({ key, title }) => (
          <div key={key} className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">{title}</h3>
            {movers[key].length === 0 ? (
              <p className="text-sm text-muted">None this month.</p>
            ) : (
              <ol className="space-y-1.5 text-sm">
                {movers[key].slice(0, 5).map((m, i) => (
                  <li key={m.slug} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="num w-4 text-muted">{i + 1}</span>
                      <Link href={`/real-estate/${m.slug}/`} className="link truncate">
                        {m.name}
                      </Link>
                    </span>
                    <Delta value={m.value} format="percent_signed" goodDirection="neutral" />
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
