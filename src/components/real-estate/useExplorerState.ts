'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  parseExplorerState,
  serializeExplorerState,
  type ExplorerState,
  type ParseContext,
} from '@/lib/urlState';

/**
 * URL-mirrored explorer state: `?m=…&metric=…&range=…&rate=1` (SPEC_WEBSITE §7.2).
 * Local state updates immediately (controls feel instant); the URL follows via
 * router.replace, and back/forward or pasted URLs flow back in.
 */
export function useExplorerState(
  ctx: ParseContext,
): [ExplorerState, (patch: Partial<ExplorerState>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fromUrl = useMemo(() => parseExplorerState(params ?? new URLSearchParams(), ctx), [params, ctx]);
  const [state, setState] = useState(fromUrl);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    const qs = serializeExplorerState(fromUrl);
    // Ignore the echo of our own replace(); accept external URL changes.
    if (pending.current === qs) {
      pending.current = null;
      return;
    }
    if (pending.current == null) setState(fromUrl);
  }, [fromUrl]);

  const update = useCallback(
    (patch: Partial<ExplorerState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        const qs = serializeExplorerState(next);
        pending.current = qs;
        router.replace(`${pathname}?${qs}`, { scroll: false });
        return next;
      });
    },
    [router, pathname],
  );
  return [state, update];
}
