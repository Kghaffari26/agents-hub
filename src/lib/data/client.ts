'use client';

import { useEffect, useState } from 'react';
import type { ZodType, ZodTypeDef } from 'zod';
import { dataUrl } from './url';

/** Client loader (SPEC_WEBSITE §8): in-memory cache, abort on unmount, zod validation. */

export type JsonState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'ok'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: string };

const cache = new Map<string, unknown>();
interface Inflight {
  promise: Promise<unknown>;
  ctrl: AbortController;
  subscribers: number;
}
const inflight = new Map<string, Inflight>();

function load<T>(path: string, schema: ZodType<T, ZodTypeDef, unknown>): Inflight {
  const url = dataUrl(path);
  let entry = inflight.get(url);
  if (entry) return entry;
  const ctrl = new AbortController();
  const promise = fetch(url, { signal: ctrl.signal })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((raw) => {
      const res = schema.safeParse(raw);
      if (!res.success) {
        const i = res.error.issues[0];
        throw new Error(`${path} failed validation at ${i.path.join('.')}: ${i.message}`);
      }
      cache.set(url, res.data);
      return res.data;
    })
    .finally(() => {
      if (inflight.get(url) === entry) inflight.delete(url);
    });
  entry = { promise, ctrl, subscribers: 0 };
  inflight.set(url, entry);
  return entry;
}

/** Fetch + validate once per URL; concurrent callers share one request. */
export async function fetchJson<T>(path: string, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const url = dataUrl(path);
  if (cache.has(url)) return cache.get(url) as T;
  return load(path, schema).promise as Promise<T>;
}

export function useJson<T>(path: string | null, schema: ZodType<T, ZodTypeDef, unknown>): JsonState<T> {
  const url = path ? dataUrl(path) : null;
  const [state, setState] = useState<JsonState<T>>(() =>
    url && cache.has(url) ? { status: 'ok', data: cache.get(url) as T } : { status: 'loading' },
  );
  useEffect(() => {
    if (!path || !url) return;
    if (cache.has(url)) {
      setState({ status: 'ok', data: cache.get(url) as T });
      return;
    }
    let alive = true;
    const entry = load(path, schema);
    entry.subscribers++;
    setState({ status: 'loading' });
    entry.promise
      .then((data) => alive && setState({ status: 'ok', data: data as T }))
      .catch((e: Error) => {
        if (!alive || e.name === 'AbortError') return;
        console.warn('[useJson]', e.message);
        setState({ status: 'error', error: e.message });
      });
    return () => {
      alive = false;
      // Abort on unmount once nobody else is waiting for this file.
      if (--entry.subscribers === 0 && !cache.has(url)) {
        entry.ctrl.abort();
        if (inflight.get(url) === entry) inflight.delete(url);
      }
    };
  }, [path, url, schema]);
  return state;
}

/** Test helper. */
export function __clearJsonCache() {
  cache.clear();
  inflight.clear();
}
