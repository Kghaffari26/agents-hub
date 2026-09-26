import type { Metadata } from 'next';
import { getAgent, getRealEstateIndex } from '@/lib/data/server';
import { RealEstatePage } from '@/components/real-estate/RealEstatePage';
import { canonical } from '@/lib/data/url';
import { ogImages } from '@/lib/data/url';
import { formatMonth, percentSigned } from '@/lib/format';

export function generateMetadata(): Metadata {
  const idx = getRealEstateIndex();
  const p = idx.national.latest.median_sale_price;
  const title = `Housing market dashboard — US median price ${percentSigned(p?.yoy)} YoY (${formatMonth(idx.data_through)})`;
  return {
    title,
    description: idx.headline,
    alternates: { canonical: canonical('/real-estate/') },
    ...ogImages('real-estate', title, idx.headline),
  };
}

export default function Page() {
  return <RealEstatePage index={getRealEstateIndex()} agent={getAgent('real_estate')} />;
}
