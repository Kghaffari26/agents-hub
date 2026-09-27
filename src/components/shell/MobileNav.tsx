'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NavLinks, type NavStatus } from './NavLinks';
import { REPO_URL } from '@/lib/data/url';

/** < 768px: a menu button that opens a full-width sheet (SPEC_WEBSITE §5). */
export function MobileNav({ statuses }: { statuses: NavStatus[] }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    sheet.current?.querySelector<HTMLElement>('a')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={btn}
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-surface-2"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </button>
      {open && (
        <div
          ref={sheet}
          id="mobile-nav"
          className="fixed inset-x-0 top-14 z-50 border-b border-border bg-bg px-4 pb-6 pt-3 shadow-lg"
        >
          <nav aria-label="Main">
            <NavLinks statuses={statuses} vertical onNavigate={() => setOpen(false)} />
          </nav>
          <a href={REPO_URL} className="link mt-4 inline-block px-3 text-sm">
            Source on GitHub
          </a>
        </div>
      )}
    </div>
  );
}
