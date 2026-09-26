import type { Repo, RepoAction, RepoMaintLatest, StalePr } from '@/lib/schemas/repoMaint';
import { DASH } from '@/lib/format';

/** Human wording for the repo-maintenance contract (SPEC_REPO_MAINT §6). */

export type CiState = Repo['ci_default_branch'];
export type Mode = RepoMaintLatest['mode'];

/** Median first-response time: under 72 h in hours ("30h"), otherwise days ("3.4 days"). */
export function formatHours(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return DASH;
  if (h < 72) return `${Math.round(h)}h`;
  const d = h / 24;
  return `${d.toFixed(1).replace(/\.0$/, '')} days`;
}

export const ROLE_LABEL: Record<Repo['role'], string> = {
  own: 'Own',
  sandbox: 'Sandbox',
  public_demo: 'Public demo',
};

export const REVIEW_LABEL: Record<StalePr['review_state'], string> = {
  none: 'No review yet',
  review_requested: 'Review requested',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  commented: 'Commented',
};

export const CI_LABEL: Record<CiState, string> = {
  success: 'Passing',
  failure: 'Failing',
  pending: 'Pending',
  none: 'No CI',
};

const ACTION_LABEL: Record<string, string> = {
  add_labels: 'Add labels',
  comment: 'Comment',
};

export function actionLabel(type: string): string {
  if (ACTION_LABEL[type]) return ACTION_LABEL[type];
  const s = type.replace(/_/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : DASH;
}

export function capitalize(s: string | null | undefined): string {
  if (!s) return DASH;
  return s[0].toUpperCase() + s.slice(1);
}

/** "p2" → "P2"; null → "—". */
export function priorityLabel(p: string | null | undefined): string {
  return p ? p.toUpperCase() : DASH;
}

export function issueUrl(repo: string, n: number): string {
  return `https://github.com/${repo}/issues/${n}`;
}

/** Short repo name for dense tables ("owner/name" → "name"). */
export function shortName(fullName: string): string {
  return fullName.split('/').pop() ?? fullName;
}

export const MODE_LABEL: Record<Mode, string> = {
  report: 'Report mode (read-only)',
  apply: 'Apply mode',
};

export const MODE_EXPLANATION: Record<Mode, string> = {
  report:
    'The agent only reads from GitHub. Labels and comments below are what it would do; nothing is written.',
  apply:
    'The agent may add labels and post one triage comment per issue, but only on repos that pass every write gate (own or sandbox repos with apply enabled). Everything else stays report-only.',
};

export function avgHealth(repos: Repo[]): number | null {
  if (!repos.length) return null;
  return Math.round(repos.reduce((s, r) => s + r.health.score, 0) / repos.length);
}

export type ActionStatus = RepoAction['status'];
