#!/usr/bin/env node
/**
 * Pre-render Open Graph images (SPEC_WEBSITE §10) with satori + resvg into public/og/:
 *   og/default.png, og/<section>.png, og/real-estate/<slug>.png (one per metro).
 * Everything is rendered here (not via opengraph-image.tsx) so one pipeline covers
 * static and [slug] routes and works under the Pages basePath.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const DATA = process.env.DATA_DIR ?? 'public/data';
const OUT = 'public/og';
const font = await readFile('node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf');
const read = async (p) => JSON.parse(await readFile(path.join(DATA, p), 'utf8'));

const h = (type, style, ...children) => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
});

function card({ kicker, title, subtitle, stats = [] }) {
  return h(
    'div',
    {
      width: 1200,
      height: 630,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 64,
      background: '#0e1015',
      color: '#eceef2',
      fontFamily: 'Noto',
    },
    h('div', { display: 'flex', fontSize: 30, color: '#6d8cff' }, `Agents Hub · ${kicker}`),
    h(
      'div',
      { display: 'flex', flexDirection: 'column' },
      h('div', { fontSize: 64, lineHeight: 1.1, display: 'flex' }, title),
      subtitle
        ? h('div', { fontSize: 30, color: '#9aa2b1', marginTop: 20, display: 'flex' }, subtitle)
        : h('div', { display: 'flex' }, ''),
    ),
    h(
      'div',
      { display: 'flex', gap: 24 },
      ...(stats.length
        ? stats.map(([label, value]) =>
            h(
              'div',
              {
                display: 'flex',
                flexDirection: 'column',
                padding: '16px 24px',
                background: '#161920',
                border: '2px solid #2a2f3a',
                borderRadius: 12,
              },
              h('div', { fontSize: 22, color: '#9aa2b1', display: 'flex' }, label),
              h('div', { fontSize: 40, display: 'flex' }, value),
            ),
          )
        : [
            h(
              'div',
              { display: 'flex', fontSize: 24, color: '#9aa2b1' },
              'Autonomous agents · fresh data on a schedule',
            ),
          ]),
    ),
  );
}

async function render(file, node) {
  const svg = await satori(node, {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Noto', data: font, weight: 400, style: 'normal' }],
  });
  const png = new Resvg(svg).render().asPng();
  await mkdir(path.dirname(path.join(OUT, file)), { recursive: true });
  await writeFile(path.join(OUT, file), png);
}

const pct = (x, d = 1) =>
  x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(d)}%`;
const money = (x) => (x == null ? '—' : `$${Math.round(x).toLocaleString('en-US')}`);
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

if (!existsSync(path.join(DATA, 'manifest.json'))) {
  console.log('[gen-og] no public/data yet; skipping');
  process.exit(0);
}
const manifest = await read('manifest.json');
await render(
  'default.png',
  card({
    kicker: 'Overview',
    title: 'Four AI agents, updated automatically',
    subtitle: 'Housing · the economy · federal contracts · code',
  }),
);
const sectionFiles = { real_estate: 'real-estate', macro: 'macro', grants: 'grants', repo_maint: 'repos' };
for (const a of manifest.agents) {
  await render(
    `${sectionFiles[a.id] ?? a.id}.png`,
    card({ kicker: a.name, title: trunc(a.headline, 110), stats: [] }),
  );
}
await render(
  'about.png',
  card({
    kicker: 'About',
    title: 'How it works: architecture, costs, methods',
    subtitle: 'Numbers computed in code; the model writes the narrative',
  }),
);
await render(
  'case-studies.png',
  card({
    kicker: 'Case studies',
    title: 'What the agents did on real runs',
    subtitle: 'Triggers, tool calls, guardrails, outcomes',
  }),
);
await render(
  'mcp.png',
  card({
    kicker: 'MCP server',
    title: 'Ask Claude about the agents’ data',
    subtitle: 'agents-mcp · read-only Model Context Protocol server',
  }),
);
const idx = await read('real_estate/latest.json');
for (const m of idx.metros) {
  const L = m.latest;
  await render(
    `real-estate/${m.slug}.png`,
    card({
      kicker: 'Real Estate',
      title: `${m.name} housing market`,
      subtitle: `Data through ${idx.data_through}`,
      stats: [
        ['Median sale price', `${money(L.median_sale_price?.value)} (${pct(L.median_sale_price?.yoy)})`],
        ['Inventory YoY', pct(L.inventory?.yoy, 0)],
        ['Temperature', `${m.temperature.label ?? '—'} ${m.temperature.score ?? ''}`],
      ],
    }),
  );
}
console.log(`[gen-og] wrote ${8 + idx.metros.length} images to ${OUT}/`);
