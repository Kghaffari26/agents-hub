import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAgent, getMetro, getRealEstateIndex } from '@/lib/data/server';
import { RealEstatePage } from '@/components/real-estate/RealEstatePage';
import { assetUrl, canonical } from '@/lib/data/url';
import { formatMonth } from '@/lib/format';

export const dynamicParams = false;

export function generateStaticParams() {
  return getRealEstateIndex().metros.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const idx = getRealEstateIndex();
  const m = idx.metros.find((x) => x.slug === slug);
  if (!m) return {};
  const title = `${m.name} housing market — ${formatMonth(idx.data_through)}`;
  const description = m.brief_excerpt || idx.headline;
  return {
    title,
    description,
    alternates: { canonical: canonical(`/real-estate/${slug}/`) },
    openGraph: {
      title,
      description,
      images: [{ url: assetUrl(`og/real-estate/${slug}.png`), width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', images: [assetUrl(`og/real-estate/${slug}.png`)] },
  };
}

export default async function MetroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const idx = getRealEstateIndex();
  const m = idx.metros.find((x) => x.slug === slug);
  if (!m) notFound();
  getMetro(slug); // validate the metro file at build time (fails the build if corrupt)
  return (
    <RealEstatePage
      index={idx}
      agent={getAgent('real_estate')}
      focusSlug={slug}
      title={`${m.name} housing market`}
    />
  );
}
