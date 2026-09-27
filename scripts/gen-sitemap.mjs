#!/usr/bin/env node
/** sitemap.xml + robots.txt at build time, including every metro slug (SPEC_WEBSITE §10). */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const isPages = process.env.GITHUB_ACTIONS === 'true' && !process.env.CUSTOM_DOMAIN;
const basePath = process.env.BASE_PATH ?? (isPages ? `/${repo}` : '');
const site = (
  process.env.SITE_URL ??
  (isPages ? `https://kghaffari26.github.io${basePath}` : `http://localhost:3000${basePath}`)
).replace(/\/+$/, '');
const DATA = process.env.DATA_DIR ?? 'public/data';

const routes = ['/', '/real-estate/', '/macro/', '/grants/', '/repos/', '/case-studies/', '/mcp/', '/about/'];
let lastmod = new Date().toISOString().slice(0, 10);
if (existsSync(`${DATA}/real_estate/latest.json`)) {
  const idx = JSON.parse(await readFile(`${DATA}/real_estate/latest.json`, 'utf8'));
  for (const m of idx.metros) routes.push(`/real-estate/${m.slug}/`);
}
const urls = routes.map((r) => `  <url><loc>${site}${r}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n');
await mkdir('public', { recursive: true });
await writeFile(
  'public/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);
await writeFile('public/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
console.log(`[gen-sitemap] ${routes.length} URLs → public/sitemap.xml (+ robots.txt)`);
