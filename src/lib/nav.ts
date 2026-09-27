/** Site sections. Adding a fifth agent = one entry here + a route + a data folder. */
export interface NavItem {
  href: string;
  label: string;
  agentId?: string;
}

export const NAV: NavItem[] = [
  { href: '/real-estate/', label: 'Real Estate', agentId: 'real_estate' },
  { href: '/macro/', label: 'Macro', agentId: 'macro' },
  { href: '/grants/', label: 'Grants', agentId: 'grants' },
  { href: '/repos/', label: 'Repos', agentId: 'repo_maint' },
  { href: '/case-studies/', label: 'Case studies' },
  { href: '/mcp/', label: 'MCP' },
  { href: '/about/', label: 'About' },
];

export const AGENT_REPOS: Record<string, { repo: string; spec: string; name: string }> = {
  real_estate: {
    repo: 'Kghaffari26/real-estate-agent',
    spec: 'docs/specs/SPEC_REAL_ESTATE.md',
    name: 'Real Estate Market Agent',
  },
  macro: { repo: 'Kghaffari26/fed-agent', spec: 'docs/specs/SPEC_MACRO.md', name: 'Macro & Fed Agent' },
  grants: {
    repo: 'Kghaffari26/sam-agent',
    spec: 'docs/specs/SPEC_GRANTS.md',
    name: 'Grants & Contracts Agent',
  },
  repo_maint: {
    repo: 'Kghaffari26/repo-maintain-agent',
    spec: 'docs/specs/SPEC_REPO_MAINT.md',
    name: 'Repo Maintenance Agent',
  },
};
