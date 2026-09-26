import Link from 'next/link';
import { getCostSummary, getManifest } from '@/lib/data/server';
import { AgentCard } from '@/components/overview/AgentCard';
import { CostStrip } from '@/components/overview/CostStrip';
import { HowItWorks } from '@/components/overview/HowItWorks';
import { LastActivity } from '@/components/common/LiveStatus';
import { formatMonth } from '@/lib/format';
import { canonical } from '@/lib/data/url';
import { ogImages } from '@/lib/data/url';

export const metadata = {
  alternates: { canonical: canonical('/') },
  ...ogImages('default'),
};

export default function OverviewPage() {
  const manifest = getManifest();
  const costs = getCostSummary();
  const lastActivity =
    manifest.agents
      .map((a) => a.last_run_at)
      .sort()
      .at(-1) ?? manifest.generated_at;
  return (
    <div className="space-y-10 pb-4">
      <section className="pt-10 md:pt-14" aria-labelledby="hero-title">
        <h1 id="hero-title" className="max-w-3xl text-2xl font-bold leading-tight md:text-3xl">
          Four AI agents that track housing, the economy, federal contracts, and code, updated automatically.
        </h1>
        <p className="mt-3 text-muted">
          Last activity: <LastActivity at={lastActivity} /> ·{' '}
          <Link href="/about/" className="link">
            How it works
          </Link>
        </p>
      </section>
      <section aria-label="Agents" className="grid gap-4 lg:grid-cols-2">
        {manifest.agents.map((a) => (
          <AgentCard key={a.id} agent={a} />
        ))}
      </section>
      <CostStrip costs={costs} monthLabel={`This month (${formatMonth(`${costs.month}-01`)})`} />
      <HowItWorks />
    </div>
  );
}
