import type { ReactNode } from 'react';
import type { ManifestAgent } from '@/lib/schemas/manifest';
import type { RunMeta } from '@/lib/schemas/common';
import { LastUpdated } from './LastUpdated';
import { SourceList, type SourceItem } from './SourceList';
import { FailureBanner } from './FailureBanner';
import { SampleBadge } from './SampleBadge';

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  agent?: ManifestAgent;
  meta?: RunMeta;
  sources?: SourceItem[];
  badges?: ReactNode;
  children?: ReactNode;
}

/** Top of every section: title, freshness, sources, failure banner (SPEC_WEBSITE §5). */
export function PageHeader({
  title,
  subtitle,
  agent,
  meta,
  sources = [],
  badges,
  children,
}: PageHeaderProps) {
  const failed = agent?.status === 'failed' || meta?.status === 'failed';
  return (
    <header className="space-y-3 pb-6 pt-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {agent?.sample && <SampleBadge repo={agent.repo} />}
        {badges}
      </div>
      {subtitle && <p className="max-w-3xl text-base text-muted">{subtitle}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {agent && (
          <LastUpdated
            at={agent.last_run_at}
            dataChangedAt={agent.last_data_change_at}
            intervalHours={agent.expected_interval_hours}
            noNewData={meta ? !meta.data_changed : false}
          />
        )}
        {agent && <span className="text-sm text-muted">Next run: {agent.next_run_hint}</span>}
      </div>
      {failed && agent && <FailureBanner failedAt={agent.last_run_at} dataFrom={agent.last_data_change_at} />}
      {children}
      <SourceList sources={sources} />
    </header>
  );
}
