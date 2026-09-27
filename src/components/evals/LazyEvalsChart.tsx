'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/common/States';
import { WhenVisible } from '@/components/common/WhenVisible';

const placeholder = <Skeleton className="h-[260px] w-full" label="Loading eval history" />;

const EvalsChart = dynamic(() => import('./EvalsChart').then((m) => m.EvalsChart), {
  ssr: false,
  loading: () => placeholder,
});

/** Code-split eval chart, loaded when scrolled near (keeps Recharts off first load). */
export function LazyEvalsChart({ id, height = 260 }: { id: string; height?: number }) {
  return (
    <div style={{ minHeight: height + 48 }}>
      <WhenVisible placeholder={placeholder}>
        <EvalsChart id={id} height={height} />
      </WhenVisible>
    </div>
  );
}
