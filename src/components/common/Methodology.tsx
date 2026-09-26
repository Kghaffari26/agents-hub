import type { ReactNode } from 'react';

/** Collapsible methodology & sources block used at the bottom of each section. */
export function Methodology({
  title = 'Methodology and sources',
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <details className="card group p-4 md:p-5" id="methodology">
      <summary className="cursor-pointer select-none text-base font-semibold">{title}</summary>
      <div className="prose-sm mt-3 space-y-3 text-sm leading-relaxed text-muted [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-text [&_strong]:text-text">
        {children}
      </div>
    </details>
  );
}

export function SectionHeading({
  id,
  children,
  action,
}: {
  id?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 id={id} className="section-title">
        {children}
      </h2>
      {action}
    </div>
  );
}
