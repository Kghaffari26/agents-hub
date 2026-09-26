'use client';

import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/data/client';
import { metroDetail, type MetroDetail } from '@/lib/schemas/realEstate';
import { US } from '@/lib/urlState';

export type DetailState = { status: 'loading' | 'ok' | 'error'; data?: MetroDetail };

/** Lazy-load each selected metro file once; cached in memory by the client loader. */
export function useMetroDetails(slugs: string[]): Record<string, DetailState> {
  const [states, setStates] = useState<Record<string, DetailState>>({});
  const key = slugs.join(',');
  useEffect(() => {
    let alive = true;
    for (const slug of key.split(',').filter((s) => s && s !== US)) {
      setStates((prev) => (prev[slug]?.status === 'ok' ? prev : { ...prev, [slug]: { status: 'loading' } }));
      fetchJson(`real_estate/metros/${slug}.json`, metroDetail)
        .then((data) => alive && setStates((prev) => ({ ...prev, [slug]: { status: 'ok', data } })))
        .catch((e) => {
          console.warn('[metro]', slug, e);
          if (alive) setStates((prev) => ({ ...prev, [slug]: { status: 'error' } }));
        });
    }
    return () => {
      alive = false;
    };
  }, [key]);
  return states;
}
