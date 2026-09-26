'use client';

import { useState } from 'react';
import { IndicatorCard } from './IndicatorCard';
import { GROUPS, type IndicatorLite } from './helpers';

/** Indicator cards grouped Inflation / Labor / Growth / Rates / Sentiment. One card expands at a time. */
export function IndicatorGrid({ indicators }: { indicators: IndicatorLite[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-8">
      {GROUPS.map((g) => {
        const items = indicators.filter((i) => i.group === g.id);
        if (!items.length) return null;
        return (
          <section key={g.id} aria-labelledby={`group-${g.id}`}>
            <h2 id={`group-${g.id}`} className="section-title mb-3">
              {g.label}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((ind) => (
                <IndicatorCard
                  key={ind.id}
                  indicator={ind}
                  expanded={open === ind.id}
                  onToggle={() => setOpen((cur) => (cur === ind.id ? null : ind.id))}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
