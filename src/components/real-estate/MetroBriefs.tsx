'use client';

import { useEffect, useRef, useState } from 'react';
import type { MetroDetail } from '@/lib/schemas/realEstate';
import { AiBrief } from '../common/AiBrief';
import { shortName } from './helpers';

const SEV: Record<string, string> = {
  major: 'border-bad/60 text-bad',
  notable: 'border-neutral/60 text-neutral',
  info: 'border-border text-muted',
};

/** One tab per selected metro with its AI brief and flags (ARIA tabs pattern). */
export function MetroBriefs({ details, initial }: { details: MetroDetail[]; initial?: string }) {
  const [active, setActive] = useState(
    initial && details.some((d) => d.slug === initial) ? initial : details[0]?.slug,
  );
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!details.some((d) => d.slug === active)) setActive(details[0]?.slug);
  }, [details, active]);
  if (!details.length) return null;
  const idx = Math.max(
    0,
    details.findIndex((d) => d.slug === active),
  );
  const cur = details[idx];
  const focus = (i: number) => {
    const n = (i + details.length) % details.length;
    setActive(details[n].slug);
    tabs.current[n]?.focus();
  };
  return (
    <div>
      <div
        role="tablist"
        aria-label="Metro briefs"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {details.map((d, i) => (
          <button
            key={d.slug}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            id={`tab-${d.slug}`}
            aria-selected={i === idx}
            aria-controls={`panel-${d.slug}`}
            tabIndex={i === idx ? 0 : -1}
            onClick={() => setActive(d.slug)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') focus(i + 1);
              if (e.key === 'ArrowLeft') focus(i - 1);
            }}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
              i === idx ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {shortName(d.name)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${cur.slug}`}
        aria-labelledby={`tab-${cur.slug}`}
        className="space-y-3 pt-3"
        tabIndex={0}
      >
        <AiBrief
          title={`${cur.name} brief`}
          text={cur.brief.text}
          keyPoints={cur.brief.key_points}
          citations={cur.brief.citations}
          model={cur.brief.model}
          generatedAt={cur.brief.generated_at}
          narrativeSource={cur.brief.narrative_source}
          reused={cur.brief.reused}
        />
        {cur.flags.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label={`${cur.name} flags`}>
            {cur.flags.map((f) => (
              <li
                key={f.id}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${SEV[f.severity]}`}
              >
                <span className="sr-only">{f.severity}: </span>
                {f.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
