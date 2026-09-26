import { agentCostsSummary, manifestEntry } from './manifest';
import { realEstateLatest, metroDetail } from './realEstate';
import { macroLatest } from './macro';
import { grantsLatest, grantsAll } from './grants';
import { repoMaintLatest } from './repoMaint';

export * from './common';
export * from './manifest';

/** Supported `meta.schema_version` major per agent (SPEC_WEBSITE §3 step 5). */
export const SUPPORTED_MAJOR: Record<string, number> = { real_estate: 1, macro: 1, grants: 1, repo_maint: 1 };

/** Every file an agent publishes that the site reads, keyed by agent → relative path pattern. */
export const AGENT_FILE_SCHEMAS = {
  real_estate: { 'latest.json': realEstateLatest, 'metros/*.json': metroDetail },
  macro: { 'latest.json': macroLatest },
  grants: { 'latest.json': grantsLatest, 'all.json': grantsAll },
  repo_maint: { 'latest.json': repoMaintLatest },
} as const;

export const COMMON_FILE_SCHEMAS = {
  'manifest-entry.json': manifestEntry,
  'costs-summary.json': agentCostsSummary,
} as const;
