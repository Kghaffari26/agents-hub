import { AlertCircle, Inbox } from 'lucide-react';

export function Skeleton({ className = '', label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <div role="status" aria-live="polite" className={`animate-pulse rounded-card bg-surface-2 ${className}`}>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border p-8 text-center text-sm text-muted">
      <Inbox className="h-6 w-6" aria-hidden />
      <p className="font-medium text-text">{title}</p>
      {children}
    </div>
  );
}

export function ErrorState({
  message = "This data didn't load correctly. It'll refresh after the next update.",
}: {
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-card border border-bad/40 bg-bad/10 p-4 text-sm"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-bad" aria-hidden />
      <p>{message}</p>
    </div>
  );
}
