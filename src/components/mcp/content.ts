/** Facts about agents-mcp (https://github.com/Kghaffari26/agents-mcp), from its README. */

export const MCP_REPO = 'Kghaffari26/agents-mcp';
export const MCP_URL = `https://github.com/${MCP_REPO}`;
const FROM = `git+${MCP_URL}`;

export const INSTALL: { id: string; title: string; note: string; lang: string; code: string }[] = [
  {
    id: 'claude-code',
    title: 'Claude Code',
    note: 'Add --scope user to make it available in every project. Check it with `claude mcp list`, or /mcp inside Claude Code.',
    lang: 'bash',
    code: `claude mcp add agents-hub -- uvx --from ${FROM} agents-mcp`,
  },
  {
    id: 'claude-desktop',
    title: 'Claude Desktop',
    note: 'Settings → Developer → Edit Config, add this to claude_desktop_config.json, then restart Claude Desktop.',
    lang: 'json',
    code: JSON.stringify(
      { mcpServers: { 'agents-hub': { command: 'uvx', args: ['--from', FROM, 'agents-mcp'] } } },
      null,
      2,
    ),
  },
  {
    id: 'http',
    title: 'Streamable HTTP',
    note: 'Stateless JSON responses at http://127.0.0.1:8000/mcp, for any MCP client that speaks HTTP.',
    lang: 'bash',
    code: `uvx --from ${FROM} agents-mcp \\\n  --transport streamable-http --host 127.0.0.1 --port 8000\nclaude mcp add --transport http agents-hub http://127.0.0.1:8000/mcp`,
  },
  {
    id: 'offline',
    title: 'Try it offline',
    note: 'Serves the bundled sample data and never touches the network (same as AGENTS_MCP_OFFLINE=1). Requires uv.',
    lang: 'bash',
    code: `uvx --from ${FROM} agents-mcp --offline`,
  },
];

export const TOOLS: { name: string; agent: string; use: string; args: string }[] = [
  {
    name: 'list_agents',
    agent: 'all',
    use: 'Status, last run, staleness, headline and key stats for each agent',
    args: '—',
  },
  {
    name: 'get_metro',
    agent: 'Real estate',
    use: "One metro's full snapshot: every metric with YoY/MoM, temperature, flags, affordability, brief",
    args: 'metro (fuzzy: "NYC", "Austin, TX"), include_series',
  },
  { name: 'compare_metros', agent: 'Real estate', use: '2–3 metros side by side', args: 'metros, metrics' },
  {
    name: 'find_metros',
    agent: 'Real estate',
    use: 'Screen and rank the 50 metros',
    args: 'temperature, flags, market_type, filters, sort_by, limit',
  },
  {
    name: 'affordability',
    agent: 'Real estate',
    use: 'Monthly P&I payment, payment-to-income, vs a year ago',
    args: 'metro, down_payment_pct, rate, price, term_years',
  },
  {
    name: 'get_indicators',
    agent: 'Macro',
    use: 'Latest readings, regimes and the brief',
    args: 'group (inflation, labor, growth, rates, sentiment)',
  },
  {
    name: 'get_indicator',
    agent: 'Macro',
    use: 'One indicator with history',
    args: 'indicator, range, start, end',
  },
  {
    name: 'get_fomc',
    agent: 'Macro',
    use: 'Latest FOMC decision, statement edits, AI read with tone',
    args: 'include_statement_text',
  },
  {
    name: 'upcoming_releases',
    agent: 'Macro',
    use: 'Economic calendar for the next N days (+ next FOMC)',
    args: 'days',
  },
  {
    name: 'search_opportunities',
    agent: 'Grants',
    use: 'Find contracts and grants',
    args: 'query, min_fit, closing_within_days, source, set_aside, sort, limit',
  },
  {
    name: 'get_opportunity',
    agent: 'Grants',
    use: 'One opportunity in full: sub-scores, reasons, red flags, pursuit summary',
    args: 'id (id, solicitation number or title)',
  },
  {
    name: 'get_repo_health',
    agent: 'Repos',
    use: 'Health of one or all watched repos, stale PRs, changelog',
    args: 'repo',
  },
  {
    name: 'get_triage_queue',
    agent: 'Repos',
    use: 'Untriaged issues by priority with suggested labels and planned actions',
    args: 'repo, priority, classification, limit',
  },
];

export const PROMPTS: { name: string; args: string; does: string }[] = [
  {
    name: 'weekly_market_brief',
    args: 'metro',
    does: 'Weekly market brief for a metro (get_metro + affordability + next week’s releases)',
  },
  {
    name: 'economy_this_week',
    args: '—',
    does: 'What changed in the economy this week (indicators + FOMC + calendar)',
  },
  {
    name: 'grant_pursuit_shortlist',
    args: 'focus, min_fit, closing_within_days',
    does: 'Shortlist of contracts and grants to pursue, with next steps',
  },
];

export const CONFIG: [string, string, string][] = [
  ['AGENTS_MCP_OFFLINE', 'unset', '1 = never touch the network; serve bundled sample data'],
  ['AGENTS_MCP_CACHE_TTL', '600', 'Seconds to cache each fetched file'],
  ['AGENTS_MCP_FAILURE_TTL', '60', 'Seconds to remember a failed fetch before retrying'],
  ['AGENTS_MCP_HTTP_TIMEOUT', '10', 'Per-request timeout (seconds)'],
  ['AGENTS_MCP_RAW_BASE', 'https://raw.githubusercontent.com', 'Base URL for data-branch files'],
];

export interface Turn {
  role: 'user' | 'tool' | 'assistant';
  text: string;
}

/** The README's example conversations (answered from the bundled sample data). */
export const CONVERSATIONS: { title: string; turns: Turn[] }[] = [
  {
    title: 'Comparing two metros',
    turns: [
      { role: 'user', text: 'Should a buyer look at Tampa or Orlando right now?' },
      { role: 'tool', text: 'compare_metros(metros=["Tampa", "Orlando"])' },
      {
        role: 'assistant',
        text: "Both are buyer's markets (temperature: Cold, 8 for Tampa and 9 for Orlando). Tampa's median sale price is $408,300 (−4.4% YoY) vs Orlando's $430,800 (−4.67%). Inventory is up 30.9% YoY in Tampa and 28.21% in Orlando, with 7.1 vs 6.7 months of supply, and 9.89% vs 9.55% of listings had price drops. Tampa is slightly further into buyer's territory.\n\nData through 2026-08-31 (Redfin Data Center, Zillow Research). Sample data.",
      },
    ],
  },
  {
    title: 'A monthly payment',
    turns: [
      { role: 'user', text: 'What would the median Austin home cost me per month with 20% down?' },
      { role: 'tool', text: 'affordability(metro="Austin", down_payment_pct=20)' },
      {
        role: 'assistant',
        text: "At Austin's median sale price of $465,100 with 20% down ($372,080 loan) at the latest 30-year rate of 6.18%, principal and interest is $2,274.05/month, about 28.1% of Austin's median household income ($97,100, 2024). A year ago the same purchase ($483,000 at 6.7%) was $2,493.35, so it's 8.8% cheaper now. Excludes taxes, insurance and PMI.\n\nRates as of 2026-09-24 (FRED MORTGAGE30US). Sample data.",
      },
    ],
  },
  {
    title: 'Screening contracts',
    turns: [
      { role: 'user', text: 'Find cloud-migration contracts with a fit of 80+.' },
      { role: 'tool', text: 'search_opportunities(query="cloud migration", min_fit=80)' },
      {
        role: 'assistant',
        text: 'Two matches, both rated Pursue:\n1. Cloud Modernization Support Services, Veterans Affairs, fit 86, due 2026-10-15 (19 days), total small business set-aside.\n2. Legacy Application Modernization (.NET to Cloud), Homeland Security, fit 82, due 2026-10-12 (16 days).\n\nWant the full pursuit summary for either? Automated screening: always read the official notice. Sample data.',
      },
    ],
  },
];
