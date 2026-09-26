import Link from 'next/link';
import { Calculator, Download, Send, Sparkles } from 'lucide-react';

const STEPS = [
  {
    Icon: Download,
    title: 'Fetch',
    body: 'Scheduled GitHub Actions pull public data: Redfin, Zillow, FRED, the Fed, SAM.gov, GitHub.',
  },
  {
    Icon: Calculator,
    title: 'Compute',
    body: 'Every number is computed in Python — changes, ranks, scores, flags. No model math.',
  },
  {
    Icon: Sparkles,
    title: 'AI summary',
    body: 'Claude writes the narrative from those numbers; a guard rejects any figure it can’t verify.',
  },
  {
    Icon: Send,
    title: 'Publish',
    body: 'Validated JSON goes to a data branch; this static site rebuilds and deploys.',
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title">
      <div className="mb-3 flex items-end justify-between">
        <h2 id="how-title" className="section-title">
          How it works
        </h2>
        <Link href="/about/" className="link text-sm">
          Architecture &amp; methods
        </Link>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ Icon, title, body }, i) => (
          <li key={title} className="card flex gap-3 p-4">
            <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-accent">
              {i + 1}
            </span>
            <div>
              <p className="flex items-center gap-1.5 font-semibold">
                <Icon className="h-4 w-4 text-accent" aria-hidden /> {title}
              </p>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
