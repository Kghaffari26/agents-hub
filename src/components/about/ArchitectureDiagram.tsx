/** Hand-authored architecture diagram (inline SVG, themed by CSS variables; no Mermaid runtime). */
export function ArchitectureDiagram() {
  const box = { fill: 'var(--surface)', stroke: 'var(--border)', strokeWidth: 1.5, rx: 10 };
  const t = { fill: 'var(--text)', fontSize: 14, fontWeight: 600 } as const;
  const m = { fill: 'var(--text-muted)', fontSize: 12 } as const;
  const agents = [
    ['real-estate-agent', 'Fridays · Redfin, Zillow, FRED, Census'],
    ['fed-agent', 'Weekdays · FRED, Federal Reserve'],
    ['sam-agent', 'Daily · SAM.gov, Grants.gov'],
    ['repo-maintain-agent', 'Daily · GitHub API'],
  ];
  return (
    <figure className="card overflow-x-auto p-4">
      <svg
        viewBox="0 0 960 420"
        className="h-auto w-full min-w-[640px]"
        role="img"
        aria-labelledby="arch-title arch-desc"
      >
        <title id="arch-title">Agents Hub architecture</title>
        <desc id="arch-desc">
          Four agent repositories run on GitHub Actions schedules using the shared agents-core package. Each
          publishes validated JSON to its own data branch and sends a repository_dispatch event. The
          agents-hub site workflow fetches every data branch, validates the JSON against zod contracts, builds
          a static Next.js export, and deploys it to GitHub Pages.
        </desc>
        <defs>
          <marker
            id="arr"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)" />
          </marker>
        </defs>
        <rect x="16" y="16" width="300" height="388" {...box} strokeDasharray="6 4" fill="var(--surface-2)" />
        <text x="32" y="44" {...t}>
          Agent repos (GitHub Actions cron)
        </text>
        <text x="32" y="62" {...m}>
          Python · agents-core: cost cap, number guard, publish
        </text>
        {agents.map(([name, sub], i) => (
          <g key={name}>
            <rect x="32" y={80 + i * 78} width="268" height="62" {...box} />
            <text x="48" y={106 + i * 78} {...t}>
              {name}
            </text>
            <text x="48" y={126 + i * 78} {...m}>
              {sub}
            </text>
            <path
              d={`M300,${111 + i * 78} C 340,${111 + i * 78} 340,210 378,210`}
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth={1.5}
              markerEnd="url(#arr)"
            />
          </g>
        ))}
        <rect x="380" y="150" width="200" height="120" {...box} />
        <text x="396" y="178" {...t}>
          data branches
        </text>
        <text x="396" y="200" {...m}>
          latest.json · history/
        </text>
        <text x="396" y="218" {...m}>
          manifest-entry.json
        </text>
        <text x="396" y="236" {...m}>
          costs-summary.json
        </text>
        <text x="396" y="254" {...m}>
          schema.json
        </text>
        <path d="M580,210 L 628,210" stroke="var(--text-muted)" strokeWidth={1.5} markerEnd="url(#arr)" />
        <text x="588" y="136" {...m}>
          repository_dispatch
        </text>
        <text x="588" y="152" {...m}>
          + cron every 6h
        </text>
        <rect x="630" y="60" width="314" height="300" {...box} />
        <text x="646" y="88" {...t}>
          agents-hub (this site)
        </text>
        {[
          'fetch-data → public/data (fixtures if missing)',
          'zod contracts: bad data fails the build',
          'Next.js static export (App Router)',
          'lint · unit · Playwright + axe',
          'upload-pages-artifact → deploy-pages',
        ].map((s, i) => (
          <g key={s}>
            <circle cx="656" cy={122 + i * 44} r="11" fill="var(--accent)" />
            <text
              x="656"
              y={126 + i * 44}
              textAnchor="middle"
              fill="var(--accent-contrast)"
              fontSize={12}
              fontWeight={700}
            >
              {i + 1}
            </text>
            <text x="676" y={126 + i * 44} fill="var(--text)" fontSize={13}>
              {s}
            </text>
          </g>
        ))}
        <path d="M787,360 L 787,392" stroke="var(--text-muted)" strokeWidth={1.5} markerEnd="url(#arr)" />
        <text x="800" y="388" {...m}>
          GitHub Pages (free, static)
        </text>
      </svg>
      <figcaption className="mt-2 text-sm text-muted">
        No server, no database, no secrets in the browser. The browser only fetches static JSON from this
        site.
      </figcaption>
    </figure>
  );
}
