import Link from 'next/link';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-24">
      <p className="num text-sm font-semibold text-accent">404</p>
      <h1 className="text-2xl font-bold">This page doesn&apos;t exist</h1>
      <p className="text-muted">The link may be old, or the metro may no longer be tracked.</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className="btn-primary">
          Go to the overview
        </Link>
        <Link href="/real-estate/" className="btn">
          Real estate
        </Link>
      </div>
    </div>
  );
}
