/** All data URLs go through here so the Pages basePath is always applied (SPEC_WEBSITE §8). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function dataUrl(path: string): string {
  const clean = path.replace(/^\/+/, '').replace(/^data\//, '');
  return `${BASE_PATH}/data/${clean}`;
}

/** Prefix a site-relative asset path (e.g. /og/austin-tx.png) with the basePath. */
export function assetUrl(path: string): string {
  return `${BASE_PATH}/${path.replace(/^\/+/, '')}`;
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? 'https://github.com/Kghaffari26/agents-hub';

/** Absolute canonical URL for a route. */
export function canonical(route: string): string {
  const r = route.endsWith('/') ? route : `${route}/`;
  return `${SITE_URL}${r === '//' ? '/' : r}`;
}

/** Open Graph / Twitter image fields for a pre-rendered image in public/og (scripts/gen-og.mjs). */
export function ogImages(name: string, title?: string, description?: string) {
  const url = assetUrl(`og/${name}.png`);
  return {
    openGraph: {
      type: 'website' as const,
      siteName: 'Agents Hub',
      title,
      description,
      images: [{ url, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' as const, title, description, images: [url] },
  };
}
