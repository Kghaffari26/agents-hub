import Link from 'next/link';
import { getManifest } from '@/lib/data/server';
import { REPO_URL } from '@/lib/data/url';
import { NavLinks, type NavStatus } from './NavLinks';
import { ThemeToggle } from './ThemeToggle';
import { MobileNav } from './MobileNav';
import { GithubIcon } from '../common/icons';

export function Header() {
  const manifest = getManifest();
  const statuses: NavStatus[] = manifest.agents.map((a) => ({
    id: a.id,
    status: a.status,
    lastRunAt: a.last_run_at,
    intervalHours: a.expected_interval_hours,
  }));
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <div className="container-page flex h-14 items-center gap-4">
        <Link href="/" className="shrink-0 text-base font-bold tracking-tight" aria-label="Agents Hub, home">
          Agents<span className="text-accent"> Hub</span>
        </Link>
        <nav aria-label="Main" className="ml-auto hidden md:block">
          <NavLinks statuses={statuses} />
        </nav>
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <ThemeToggle />
          <a
            href={REPO_URL}
            className="hidden h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text sm:inline-flex"
            aria-label="Source code on GitHub"
          >
            <GithubIcon className="h-5 w-5" />
          </a>
          <MobileNav statuses={statuses} />
        </div>
      </div>
    </header>
  );
}
