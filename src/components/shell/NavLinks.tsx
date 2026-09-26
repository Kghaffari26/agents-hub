'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';
import { effectiveStatus } from '@/lib/stale';
import { useNow } from '@/lib/hooks';
import type { RunStatus } from '@/lib/schemas/common';

export interface NavStatus {
  id: string;
  status: RunStatus;
  lastRunAt: string;
  intervalHours: number;
}

const DOT: Record<RunStatus, string> = { ok: 'bg-good', stale: 'bg-neutral', failed: 'bg-bad' };
const WORD: Record<RunStatus, string> = { ok: 'up to date', stale: 'stale', failed: 'last run failed' };

export function isActive(pathname: string, href: string) {
  const h = href.replace(/\/$/, '');
  const p = pathname.replace(/\/$/, '');
  return p === h || p.startsWith(`${h}/`);
}

export function NavLinks({
  statuses,
  vertical = false,
  onNavigate,
}: {
  statuses: NavStatus[];
  vertical?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? '/';
  const now = useNow();
  return (
    <ul className={vertical ? 'flex flex-col gap-1' : 'flex items-center gap-1'}>
      {NAV.map((item) => {
        const s = item.agentId ? statuses.find((x) => x.id === item.agentId) : undefined;
        const st = s ? effectiveStatus(s.status, s.lastRunAt, s.intervalHours, now) : null;
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
              } ${vertical ? 'text-base' : ''}`}
            >
              {st && (
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${DOT[st]}`}
                  aria-hidden="true"
                  title={WORD[st]}
                />
              )}
              {item.label}
              {st && <span className="sr-only">({WORD[st]})</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
