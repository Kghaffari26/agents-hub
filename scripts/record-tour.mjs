#!/usr/bin/env node
/**
 * Record the README hero GIF: a ~20-second scripted tour of the built site.
 *
 *   npm run build                       # out/ (fixtures or live data)
 *   FFMPEG=/path/to/ffmpeg node scripts/record-tour.mjs [--out docs/hero.gif]
 *
 * Serves out/ (scripts/serve-out.mjs) and drives a Playwright tour at 1280×800, capturing lossless
 * screenshots as frames with explicit hold times (a recorded video is lossy, and its codec noise
 * makes every GIF frame differ). ffmpeg then builds the GIF with one shared palette; the script
 * shrinks it until it is under 3 MB.
 * ffmpeg: $FFMPEG, else `ffmpeg` on PATH (`pip install imageio-ffmpeg` bundles a static one:
 * `python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"`).
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'docs/hero.gif';
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const PORT = Number(process.env.TOUR_PORT ?? 4180);
const MAX_BYTES = 3 * 1024 * 1024;
const W = 1280;
const H = 800;

const server = spawn('node', ['scripts/serve-out.mjs'], {
  env: { ...process.env, PORT: String(PORT), BASE_PATH: '' },
  stdio: 'ignore',
});
const base = `http://localhost:${PORT}/`;
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 200));
}

const videoDir = mkdtempSync(path.join(tmpdir(), 'tour-'));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  colorScheme: 'light',
  reducedMotion: 'reduce',
});
const page = await context.newPage();
// The metro the investigator explained this run (falls back to Austin).
const idx = JSON.parse(readFileSync('out/data/real_estate/latest.json', 'utf8'));
const investigated = idx.investigations?.[0]?.slug ?? 'austin-tx';
const frames = [];
/** Capture the viewport as a frame shown for `ms`. */
async function pause(ms) {
  const file = path.join(videoDir, `f${String(frames.length).padStart(3, '0')}.png`);
  await page.screenshot({ path: file });
  frames.push({ file, ms });
}
/**
 * Quick 4-step scroll: enough to read as motion, few enough frames to keep the GIF small (every
 * scrolled frame is a full-frame change for the encoder).
 */
async function scrollTo(locator, offset = 90) {
  const y = await locator
    .first()
    .evaluate((el, o) => el.getBoundingClientRect().top + window.scrollY - o, offset);
  await page.evaluate(async (target) => {
    const start = window.scrollY;
    window.__tour = { start, target };
  }, y);
  for (let i = 1; i <= 4; i++) {
    await page.evaluate((k) => {
      const { start, target } = window.__tour;
      window.scrollTo(0, start + ((target - start) * k) / 4);
    }, i);
    await pause(90);
  }
}

try {
  // 1. Overview: four agents at a glance.
  await page.goto(base);
  await page.waitForLoadState('networkidle');
  await pause(2900);

  // 2. Real estate: the metro investigation.
  await page.goto(`${base}real-estate/${investigated}/`);
  await page.waitForLoadState('networkidle');
  await pause(500);
  await scrollTo(page.getByTestId('investigations'));
  await pause(2100);

  // 3. Macro: what's driving this.
  await page.goto(`${base}macro/`);
  await page.waitForLoadState('networkidle');
  await scrollTo(page.getByTestId('whats-driving'));
  await pause(1900);

  // 4. Grants: a bid-research brief with USAspending citations.
  await page.goto(`${base}grants/`);
  await page.waitForLoadState('networkidle');
  const br = page.getByTestId('bid-research').first();
  await scrollTo(br, 260);
  await br.locator('> summary').click();
  await pause(2100);

  // 5. Repos: a draft PR awaiting human review, then the run trace.
  await page.goto(`${base}repos/`);
  await page.waitForLoadState('networkidle');
  await scrollTo(page.getByTestId('fix-proposal'));
  await pause(2100);
  const trace = page.getByTestId('run-trace');
  await scrollTo(trace);
  await trace.getByTestId('trace-details').locator('summary').click();
  await page.getByTestId('trace-timeline').waitFor();
  await pause(600);
  await scrollTo(page.getByTestId('trace-timeline').locator('[data-kind="agent_loop"]'), 200);
  await pause(1900);

  // 6. MCP: ask Claude.
  await page.goto(`${base}mcp/`);
  await page.waitForLoadState('networkidle');
  await pause(500);
  await scrollTo(page.getByTestId('mcp-conversation'), 120);
  await pause(2900);
} finally {
  await context.close();
  await browser.close();
  server.kill();
}

const list = path.join(videoDir, 'frames.txt');
const lines = frames.flatMap((f) => [`file '${f.file}'`, `duration ${(f.ms / 1000).toFixed(3)}`]);
// The concat demuxer ignores the last duration unless the last file is repeated.
writeFileSync(list, [...lines, `file '${frames.at(-1).file}'`, ''].join('\n'));
const total = frames.reduce((t, f) => t + f.ms, 0) / 1000;
console.log(`[record-tour] ${frames.length} frames, ${total.toFixed(1)} s`);

function encode(width, colors) {
  const scale = `scale=${width}:-1:flags=lanczos`;
  const palette = path.join(videoDir, 'palette.png');
  const input = ['-f', 'concat', '-safe', '0', '-i', list];
  execFileSync(FFMPEG, [
    '-y',
    '-v',
    'error',
    ...input,
    '-vf',
    `${scale},palettegen=max_colors=${colors}`,
    palette,
  ]);
  execFileSync(FFMPEG, [
    '-y',
    '-v',
    'error',
    ...input,
    '-i',
    palette,
    '-lavfi',
    `${scale} [x]; [x][1:v] paletteuse=dither=none:diff_mode=rectangle`,
    '-fps_mode',
    'passthrough',
    OUT,
  ]);
  return statSync(OUT).size;
}

// Shrink until it fits the budget.
let size = 0;
for (const [width, colors] of [
  [1000, 128],
  [960, 96],
  [880, 64],
  [800, 48],
]) {
  size = encode(width, colors);
  console.log(`[record-tour] ${OUT}: ${width}px, ${colors} colors → ${(size / 1024 / 1024).toFixed(2)} MB`);
  if (size <= MAX_BYTES) break;
}
rmSync(videoDir, { recursive: true, force: true });
if (size > MAX_BYTES) {
  console.error(`[record-tour] still over 3 MB (${size} bytes)`);
  process.exit(1);
}
