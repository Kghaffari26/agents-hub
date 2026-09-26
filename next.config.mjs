// Static export for GitHub Pages. See docs/specs/SPEC_WEBSITE.md §12.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const isPages = process.env.GITHUB_ACTIONS === 'true' && !process.env.CUSTOM_DOMAIN;
// BASE_PATH lets local builds reproduce the Pages layout (e.g. BASE_PATH=/agents-hub).
const basePath = process.env.BASE_PATH ?? (isPages ? `/${repo}` : '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_BUILD_SHA: (process.env.GITHUB_SHA ?? process.env.BUILD_SHA ?? 'dev').slice(0, 7),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_SITE_URL:
      process.env.SITE_URL ??
      (isPages ? `https://kghaffari26.github.io${basePath}` : `http://localhost:3000${basePath}`),
    NEXT_PUBLIC_REPO_URL: 'https://github.com/Kghaffari26/agents-hub',
  },
};

export default nextConfig;
