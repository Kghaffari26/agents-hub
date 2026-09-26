'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import { Skeleton } from '@/components/common/States';
import { WhenVisible } from '@/components/common/WhenVisible';
import type { YieldCurve as YC } from './YieldCurve';

const placeholder = <Skeleton className="h-[560px]" label="Loading yield curve" />;

const YieldCurve = dynamic(() => import('./YieldCurve').then((m) => m.YieldCurve), {
  ssr: false,
  loading: () => placeholder,
});

/** Client-only, code-split yield curve, loaded when scrolled near (Recharts stays off the critical path). */
export function LazyYieldCurve(props: ComponentProps<typeof YC>) {
  return (
    <WhenVisible placeholder={placeholder}>
      <YieldCurve {...props} />
    </WhenVisible>
  );
}
