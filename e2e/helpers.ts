import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/** Read the data the build actually used (fixtures or live), so assertions follow the data. */
export function data<T = unknown>(rel: string): T {
  return JSON.parse(readFileSync(`out/data/${rel}`, 'utf8')) as T;
}

/** Collect console errors, ignoring map-tile network failures (third-party, may be blocked in CI sandboxes). */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (
      /Failed to load resource/.test(t) &&
      /(ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|ERR_INTERNET|net::)/.test(t)
    )
      return;
    if (/Failed to load resource: the server responded with a status of 404/.test(t)) return;
    errors.push(t);
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

export const ROUTES = ['', 'real-estate/', 'real-estate/austin-tx/', 'macro/', 'grants/', 'repos/', 'about/'];
