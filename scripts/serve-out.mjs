#!/usr/bin/env node
/** Serve out/ under the configured basePath (mirrors GitHub Pages) for e2e and Lighthouse. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const port = Number(process.env.PORT ?? 4173);
const base = (process.env.BASE_PATH ?? '').replace(/\/+$/, '');
const root = path.resolve('out');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

async function file(p) {
  try {
    const s = await stat(p);
    if (s.isDirectory()) return file(path.join(p, 'index.html'));
    return p;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  let url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (base) {
    if (url === '/') return res.writeHead(302, { Location: `${base}/` }).end();
    if (!url.startsWith(`${base}/`) && url !== base) return res.writeHead(404).end('not under basePath');
    url = url.slice(base.length) || '/';
  }
  const target = path.join(root, path.normalize(url));
  if (!target.startsWith(root)) return res.writeHead(403).end();
  let f = await file(target);
  let status = 200;
  if (!f) {
    f = path.join(root, '404.html');
    status = 404;
  }
  const type = types[path.extname(f)] ?? 'application/octet-stream';
  let body = await readFile(f);
  const headers = {
    'Content-Type': type,
    'Cache-Control': f.includes('/_next/static/')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=600',
  };
  // GitHub Pages gzips text responses; mirror that so Lighthouse numbers are realistic.
  if (/gzip/.test(String(req.headers['accept-encoding'])) && /text|javascript|json|xml|svg/.test(type)) {
    body = gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
  }
  res.writeHead(status, headers);
  res.end(body);
}).listen(port, () => console.log(`serving out/ at http://localhost:${port}${base}/`));
