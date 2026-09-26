import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom lacks these; charts and media-query hooks need them.
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver ??= RO;
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IntersectionObserver ??= class {
  constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) {}
  // Everything is "visible" in tests, so deferred sections render.
  observe() {
    queueMicrotask(() => this.cb([{ isIntersecting: true }]));
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};
