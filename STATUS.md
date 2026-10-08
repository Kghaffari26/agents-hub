# Status — agents-hub website

_Last updated 2026-09-27 (session 3: agentic additions — traces, evals, agent-loop outputs, case studies, MCP)._

## 2026-10-08: real-estate alert figures

The alerts strip on /real-estate now shows real-estate 1.1.0's `alerts[].metros`: the group label is the threshold ("Inventory up ≥25% YoY") and each metro gets its own figure ("Tampa +31% YoY"), major first then largest, with the rest under "+N more". It's read leniently like the other §6.x fields, and the sample data carries it. Also fixed a date-dependent e2e test (the overview card test now pins its clock after the newest run, since sample runs older than their interval add a "Stale" badge). Vitest **254 passed**, Playwright + axe **52 passed**, lint/typecheck clean, `/real-estate` first-load JS unchanged at 144 KB.

## Done

SPEC_WEBSITE.md §16 steps 1–9, adapted to the multi-repo layout:

1. **Scaffold** — Next.js 15 App Router at the repo root, strict TS, Tailwind with the §6 tokens, class-based dark mode with a no-flash script, static export with basePath, shell (header with status dots, mobile sheet, theme toggle system/light/dark, footer with attributions, build time and commit SHA), 404.
2. **Contracts and fixtures** — `config/sources.json`; `scripts/fetch-data.mjs` (data branches → `public/data`, per-agent fixture fallback with `sample: true` and a "Sample data" badge, assembled `manifest.json` and `costs/summary.json`); `scripts/gen-types.mjs` (schema.json → TS + zod when a live schema exists, else stubs over the hand-written contract); hand-written zod matching each agent spec's §6 in `src/lib/schemas/`; build-time and client loaders with `dataUrl()`; realistic deterministic fixtures for all four agents (50 metros with per-metro files, 24 macro indicators with 10-year series and a real FOMC diff, 96 grant/contract opportunities, 6 repos); contract tests including broken fixtures.
3. **Common components and formatters** — PageHeader, LastUpdated (stale + "no new data since"), SourceList, StatCard, Delta, Sparkline, AiBrief (citations, model, AI vs template label), Empty/Error/Skeleton, AgentStatusBadge, FailureBanner, SampleBadge, Segmented, Methodology; all §6 formatters.
4. **Overview and About** — agent cards with client-side stale detection, live "last activity", cost transparency strip, how-it-works; About with an inline SVG architecture diagram, per-agent explanations linking each repo/spec, cost chart and per-run costs, engineering choices, sources/licenses, limitations.
5. **Real estate** — national strip, national brief, alerts strip, metro explorer (WAI-ARIA combobox, compare up to 3 + U.S., metric toggle from `metric_registry`, 1Y/2Y/3Y, mortgage-rate overlay on a right axis, chart with data-table toggle and generated aria-label, stat table with best/worst, temperature with component explainer, per-metro brief tabs), URL state (`?m=…&metric=…&range=…&rate=1`, defensive parsing), Leaflet map (dynamic import, no SSR, diverging color clamped at p5/p95, sqrt size, click-to-compare replacing the oldest, legend, sortable table fallback), movers, affordability calculator ($400,000 at 6.5%/30y = **$2,528.27**, then vs now, % of median household income), methodology, and 50 static `/real-estate/[slug]` pages with their own metadata and OG images.
6. **Macro** — regime strip, "what changed" brief with footnoted citations, grouped indicator grid (sparklines, revision badges like "Jul revised: +73K → +41K", delayed badges, next release, expandable 2Y/5Y/10Y charts that lazy-load the full series), yield curve with shaded 10Y–2Y spread and inversion bands plus a current-curve snapshot, FOMC panel (decision, votes/dissents, countdown, AI read with tone-shift badge, key phrases), word-level statement diff (jsdiff; inline + side-by-side; `<ins>`/`<del>`; collapsed unchanged paragraphs; key edits), minutes, 14-day release calendar, methodology with raw events.
7. **Grants** — profile chip, summary strip, top-10 match cards (fit meter + sub-score meters, recommendation, countdown, value, AI summary with risks/next steps, reasons, NEW/Updated, red flags), TanStack table over lazy `all.json` (search, source, type, agency multi-select, set-aside, NAICS, closing within N days, min fit, new only; every column sorts; 25/page; row expansion; RFC 4180 CSV export of all filtered rows), 30-day deadline timeline, methodology, profile section.
8. **Repos** — mode badge, repo cards (health grade with keyboard-accessible penalty breakdown, counts, CI, 12-week activity), triage queue (labels, missing info, duplicates, applied column in apply mode), stale PRs with copyable nudges, sanitized changelog drafts (no raw HTML) with copy, actions log.
9. **Quality and deploy** — axe on every route in both themes, Lighthouse CI config, sitemap + robots with every metro, OG images for every route (satori + resvg), per-route data-driven metadata and canonical URLs, `.github/workflows/deploy.yml` (push to main, `repository_dispatch: agent-data-updated`, cron `0 */6 * * *`, manual; fetch-data → gen:types → lint → unit → build → Playwright + axe → Lighthouse (warn) → upload-pages-artifact → deploy-pages; basePath `/agents-hub`).

Also: README (pitch, screenshots, architecture, links to the four agent repos and agents-core), CLAUDE.md, DECISIONS.md. Pages were checked with Playwright screenshots at 1280px and 375px in light and dark; fixes made from that pass include a horizontal overflow on /repos, a hydration error on /about, Tailwind opacity classes that generated no CSS, a noisy stat table, cost-strip wrapping, and a chart scale warning.

## Tests

| Suite                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest (unit, component, contract) | **248 passed**, 18 files (was 207). New: agentic contracts (fixtures parse with every new field; older data without them; a malformed field/item is dropped and reported with its path; citations in both spellings; unknown span kinds; eval-history normalization for agents-core and agents-mcp lines; the agents' real excerpts), trace model (depth-first layout, orphans, filters keep ancestors, collapse, span descriptions), TraceView (timeline ↔ table, filter, subtree collapse), RunTrace (roll-up, no-trace state), evals summary + deltas, diff parsing, FixProposals statuses, BidResearch (go/no-go, partial research, USAspending citations), investigations (summary vs full), What's driving this, inline code rendering, case-study link resolution, and fetch-data's repo-file step (live checkout with an invalid line, sample fallback with reason, lenient-field warning without fallback). |
| Playwright e2e + axe               | **51 passed** (was 33) on the current data (agent sample data + live evals/case studies), **51 passed** on all-offline fixtures, and **51 passed** with `BASE_PATH=/agents-hub`. New: run trace on all four agent pages (opens, summary matches the file, timeline → table with every span, arrow-key toggle, no console errors), evals latest table + chart + data table, each agentic output, case studies (4 sections, no scripts, anchors), /mcp (3 conversations, 13 tools, copy puts the exact install command on the clipboard), /about evals ×5; axe (serious/critical) and no-horizontal-scroll at 360px now cover /case-studies and /mcp in both themes.                                                                                                                                                                                                                                                   |
| `npm run lint`                     | clean (eslint 0 problems, prettier clean) · `tsc --noEmit` clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run build`                    | succeeds; 59 HTML pages (8 routes + 50 metro pages + 404)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

First-load JS (gzipped, `next build`): `/` **111 KB** (budget 120, unchanged), `/real-estate` **144 KB** (budget 250), `/macro` 120 KB, `/grants` 152 KB, `/repos` 112 KB, `/about` 111 KB, `/case-studies` 108 KB, `/mcp` 108 KB. The trace view and eval charts are code-split (`next/dynamic`, loaded on open / when scrolled near), so the new panels cost the agent pages 2–6 KB each.

## Lighthouse (mobile, simulated slow 4G, local server with gzip like Pages)

Not re-measured this session (first-load JS moved by ≤ 6 KB per page and the new panels load lazily); the table is from session 1.

| Route                     | Perf   | A11y | Best practices | SEO | LCP   | TBT        | CLS |
| ------------------------- | ------ | ---- | -------------- | --- | ----- | ---------- | --- |
| `/`                       | 98–99  | 100  | 100            | 100 | 2.0 s | 98 ms      | 0   |
| `/real-estate/`           | 92–98* | 100  | 100            | 100 | 2.1 s | 104–323 ms | 0   |
| `/real-estate/austin-tx/` | 97     | 100  | 96             | 100 | 2.3 s | 138 ms     | 0   |
| `/macro/`                 | 95     | 100  | 96             | 100 | 2.1 s | 237 ms     | 0   |
| `/grants/`                | 95     | 100  | 96             | 100 | 2.6 s | 140 ms     | 0   |
| `/repos/`                 | 95     | 100  | 96             | 100 | 2.1 s | 220 ms     | 0   |
| `/about/`                 | 96     | 100  | 96             | 100 | 2.2 s | 170 ms     | 0   |

\* range over 4 runs. Budgets (§11: `/` ≥ 95, `/real-estate` ≥ 90, CLS < 0.05) are met. Best practices was 96 on every route until a favicon was added (the only failing audit was the `/favicon.ico` 404); re-measured 100 on `/` and `/real-estate`, the other rows are from the earlier sweep.

## This session: agentic additions (agents-core v0.3.0, agent schema 1.1.0)

All four agent repos and agents-core were upgraded in parallel with this work. I built against agents-core v0.3.0's code, then re-checked each agent's `main` before finishing: **all four published their §6.x additions on 2026-09-27 and the site now reads their exact shapes** (my first guesses for the four outputs were replaced). Shapes, provenance and tolerance rules: [`docs/specs/AGENTIC_ADDITIONS.md`](docs/specs/AGENTIC_ADDITIONS.md).

| Feature                                                                                                                                                                                                                                                                                                                                    | Where                                                      | Source                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| **Run trace** panel: roll-up (LLM calls, tool calls, loop steps, guard retries, LLM cost, latency) + collapsible span list as a **timeline** (bars on a shared time axis, collapsible subtrees, filters "LLM, tools & guards" / "Errors & retries") or a **text table**; `trace.json` is fetched and the view code loaded only when opened | every agent page (incl. 50 metro pages)                    | agents-core `trace.json`, else `manifest-entry.json` `trace_summary` |
| **Evals**: latest score per suite with change vs the previous run (▲/▼ + pts), model/prompt/sha/cases/cost, and a lazy Recharts history chart per suite with a data-table toggle                                                                                                                                                           | every agent page; all five on /about; agents-mcp's on /mcp | each repo's `evals/history.jsonl` on `main` (fetched at build)       |
| **Metro investigations** (index summaries with each cited metric's value and YoY; full explanation + tool calls on the metro page)                                                                                                                                                                                                         | /real-estate, /real-estate/[slug]                          | SPEC_REAL_ESTATE §6.3                                                |
| **What's driving this** (trigger, analysis, cited FRED series with current values, tool calls, guard attempts)                                                                                                                                                                                                                             | /macro                                                     | SPEC_MACRO §6.1 `investigation`                                      |
| **Bid research** (go/no-go, what they're buying, criteria, incumbent, prior-awards table, risks, **USAspending citations** listed separately) inside each researched top-match card                                                                                                                                                        | /grants                                                    | SPEC_GRANTS §6.3 `top_matches[].research`                            |
| **Fix proposals**: "**Draft PR — awaiting human review**" card with a unified-diff preview (+/− kept in text, long diffs collapsed), rationale, approval id; `no_fix` / `stopped` / `approval_blocked` / `failed` / `pr_opened` labeled                                                                                                    | /repos                                                     | SPEC_REPO_MAINT §6.1 `repos[].fix_proposals`                         |
| **/case-studies**: each repo's `docs/case-studies.md`, sanitized Markdown, relative links resolved to GitHub                                                                                                                                                                                                                               | new route                                                  | `main` branch                                                        |
| **/mcp**: what agents-mcp is, 4 install snippets with copy buttons (Claude Code, Claude Desktop JSON, streamable HTTP, offline), 3 example conversations, the 13 tools, prompts, resources, config, and its tool-selection eval                                                                                                            | new route                                                  | agents-mcp README + `evals/history.jsonl`                            |
| **README**: 20-second hero GIF (`docs/hero.gif`, 2.5 MB, recorded by `scripts/record-tour.mjs`), **Highlights**, **Architecture** table + Mermaid diagram linking all seven repos                                                                                                                                                          | README                                                     | —                                                                    |

Also: nav gains Case studies and MCP (desktop nav now from `lg`, the menu sheet below it); OG images and sitemap entries for both routes; USAspending in the footer attributions; /about's architecture diagram shows trace.json and agents-mcp, and its text covers agent loops, traces and evals.

**Tolerance (older data never breaks a page).** Every new field is optional, and on a §6 body it is parsed with `lenient()` / `lenientArray()`: a malformed field or array item is dropped (the section just doesn't show it) instead of sending the agent to sample data. `fetch-data` also checks the fields strictly and logs `"<file>: <field> doesn't match the documented shape at <path> (not shown)"`, and says when an agent publishes no `trace.json` yet. Real outputs from before v0.3.0 (`test/fixtures/real/`) still validate.

**Data pipeline.** `fetch-data` now also reads, from each repo's default branch, `evals/history.jsonl` (5 sources incl. agents-mcp; JSONL normalized, invalid lines skipped and counted, last 400 entries) and `docs/case-studies.md` (≤ 300 KB, not HTML), each with its own per-file sample fallback and a second summary table; `--local-repo <id>=<dir>` reads them from a checkout. Current output — every repo file is live, agent data still sample (no `data` branch yet):

```
[fetch-data] repo files (main branch): 9/9 live
  evals/real_estate         live    5 entries
  evals/macro               live    5 entries
  evals/grants              live    4 entries
  evals/repo_maint          live    8 entries
  evals/agents_mcp          live    1 entries
  case-studies/real_estate  live    ok
  case-studies/macro        live    ok
  case-studies/grants       live    ok
  case-studies/repo_maint   live    ok
```

**Sample data for every new field.** `scripts/gen_agentic_fixtures.py` (run by `npm run gen:fixtures`) reads the §6 fixtures it follows and writes `trace.json` per agent (agents-core span shapes on a simulated clock, LLM span costs summing to each run's `cost_usd`, one tool timeout, guard retries), `trace_summary`, the four §6.x outputs in the agents' published shapes (numbers taken from the sample data, e.g. Detroit as the top mover, the FOMC cut, the VA cloud recompete, a CSV-quoting fix in the sandbox repo), eval histories and case studies.

**Validated against the agents' own output.** `test/fixtures/real-excerpts/`: fed-agent's published `investigation` and `trace.json` excerpts, the JSON examples in all three other agent specs, and repo-maintain-agent's committed real 1.1.0 run (`latest.json` with `fix_proposals`, `trace.json`, `manifest-entry.json` with `trace_summary`) — all parse, with no agentic-field warnings.

## Session 2: live data readiness (agents-core v0.1.0)

All four agents now publish agents-core `RunMeta`, so the site is set up to go live the moment each `data` branch appears.

- **`meta` aligned with agents-core `RunMeta`** (`src/lib/schemas/common.ts`): the v0.1.0 fields exactly, plus forward compatibility with v0.2.0 — any `1.x` schema_version (major still enforced), optional `warnings: string[]`, and unknown agent-specific meta keys passed through. §6 bodies unchanged.
- **Validated against real agent output.** Real runs of all four agents (2026-09-26) pass the site's validators and render with no console errors; full e2e + axe (33 tests) pass on a build made from them. Trimmed copies are contract fixtures in `test/fixtures/real/<agent>/` (provenance in its README). How each was produced, spending $0:
  - `real_estate`: `agents-run real_estate` against live Redfin/Zillow/FRED; all 51 briefs reused from the agent's committed LLM cache.
  - `macro`: agents-core runner against live FRED/federalreserve.gov; no-change day, brief and FOMC read reused from committed state.
  - `grants`: agents-core runner against live SAM.gov/Grants.gov with no LLM (nothing scored), plus a second run over the same cached data scored by the agent's own test `FakeClient` (`grants__fake-llm`) to cover `top_matches`.
  - `repo_maint`: the agent's committed `public-data/` (a real report-mode run).
- **Site-side fixes from that check:** two tolerated agent deviations (below), and the macro e2e no longer assumes a revision badge exists.
- **`fetch-data` says why** an agent fell back: one log line per agent with the kind (`missing_repo`, `missing_branch`, `missing_file`, `http`, `network`, `invalid_json`, `validation`, `offline`), the file, and for validation up to 10 zod paths; then a live/sample summary table in the build log and the Actions job summary. `_fetch-report.json` holds the same, structured. New: `--local <agent>=<dir>` to build from a local run, and `scripts/validate-data.mjs <agent> <dir>` to list every contract issue in one.

Current `npm run fetch-data` output (no agent has pushed its `data` branch yet):

```
[fetch-data] summary: 0/4 agents live, 4 using sample data
  agent        data    files  schema / reason  detail
  real_estate  SAMPLE  —      missing_branch   Kghaffari26/real-estate-agent has no "data" branch yet (agent hasn't published)
  macro        SAMPLE  —      missing_branch   Kghaffari26/fed-agent has no "data" branch yet (agent hasn't published)
  grants       SAMPLE  —      missing_branch   Kghaffari26/sam-agent has no "data" branch yet (agent hasn't published)
  repo_maint   SAMPLE  —      missing_branch   Kghaffari26/repo-maintain-agent has no "data" branch yet (agent hasn't published)
```

With the real outputs as `--local` sources the same table reads `4/4 agents live`.

## Agent-side fixes needed

Status after the agents' 1.1.0 upgrades (2026-09-27): per their specs, **1** (repo-maint now publishes `"template"`, confirmed in its committed 1.1.0 run) and **2** (real-estate `delta_format` is now a standard `StatFormat`) are fixed agent-side. The site keeps both tolerances until each agent's `data` branch is live on 1.1.0, then they can be removed. 3 and 4 are unverified.

These are accepted by the site for now (each has a `TODO(<agent>)` in `src/lib/schemas/` and a contract test), so they don't block live data, but the agents should fix them:

1. **repo-maintain-agent** — `repos[].changelog.narrative_source` is `"deterministic"` (`agents/repo_maint/schema.py`: `Literal["llm", "deterministic"]`). agents-core and SPEC_REPO_MAINT §6 allow only `"llm" | "template"`. The site reads it as `"template"`. Fix: publish `"template"`.
2. **real-estate-agent** — for `change_kind: diff` metrics, `delta_format` is `"<unit>_signed"` (`metrics.py` → `days_signed`, `months_signed`, or `diff_signed` with no unit), and `schema.py` types it as `str`. These aren't agents-core `StatFormat` values. The site maps `days_signed → days`, `months_signed → decimal1`, other `*_signed → null`. Fix: emit `days` / `decimal1` (or add the formats to agents-core's `StatFormat` first, then the site).
3. **sam-agent** — with no Anthropic key, `agents-run grants` crashes: `scoring.score_opportunities` catches `LLMError` but the missing-key `RuntimeError` from the client escapes, and the runner publishes a `failed` manifest entry. Not a contract issue, but it means a missing secret takes the whole section down instead of degrading to unscored. (fed-agent has the same pattern at the agents-core level: only `LLMError` falls back to templates.)
4. **real-estate-agent** — `state.py` writes `data/real_estate/state.json` at a fixed path instead of under `AGENTS_CORE_DATA_DIR`. Harmless in CI; noted because local runs with a custom data dir still modify the repo.
5. Observed, not bugs: real_estate `payment_to_income` is null without `CENSUS_API_KEY`, and permits are skipped (Census file layout unverified); the site shows "—" for both. `manifest-entry.json`'s `last_data_change_at` is null on a first publish (the site handles it).

## Known gaps

- real-estate-agent now has a `data` branch, but it holds only a failed run (2026-10-02T19:43Z, run `2026-10-02T19-43-13Z-730724`): its `trace.json` shows the fetch and transform phases succeeded, then the first LLM call (the 50-metro brief batch) got **401 `invalid x-api-key`** from Anthropic, which wasn't an `LLMError`, so the whole run failed and no `latest.json` was published; the site falls back to sample data (`missing_file`). The agent was fixed on 2026-10-08 (`4622e3d`: a rejected key now publishes template briefs with a warning instead of failing), but the repo's `ANTHROPIC_API_KEY` secret still needs replacing for AI briefs and investigations. The next run (Friday cron or a manual dispatch) will publish either way.

- **No agent has a `data` branch yet**, so agent data, traces and the four agentic outputs are still sample data (badged). Evals and case studies are already live from each repo's `main`.
- Eval scores are shown as published (0–1 → %); suites whose scorer isn't a 0–1 average (e.g. agents-mcp's `n`) are shown as counts, not charted.
- The README GIF is recorded against sample agent data; re-record with `scripts/record-tour.mjs` once agents publish.

- The site switches to live agent data on the next deploy after an agent publishes (verified locally with real runs); the build log's fetch-data summary shows why per agent otherwise.
- OSM tiles were blocked in the build sandbox, so map screenshots show markers without tiles; tiles load normally on the public site. For heavier traffic set `NEXT_PUBLIC_MAP_TILES` to a free-tier provider (OSM fair-use policy).
- Leaflet markers themselves aren't keyboard-focusable; the "View as table" fallback (tested) provides the same data and a Compare button per metro.
- Lighthouse CI in the workflow warns only (spec v1); `@next/bundle-analyzer` is not wired (sizes come from `next build`).
- `gen:types` output is not diff-checked in CI (it legitimately changes when an agent publishes a new schema).
- Relative times first render from the build time, then switch to the visitor's clock after hydration (avoids hydration mismatches).

## Steps for you

0. **Nothing new is required for this session's features**: traces, agentic outputs and `trace_summary` appear as soon as each agent's `data` branch is published on agents-core v0.3.0; evals and case studies already update on every deploy.

1. **Enable GitHub Pages:** repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. Then run the **Deploy site** workflow once (Actions → Deploy site → Run workflow), or push to `main`. The site will be at `https://kghaffari26.github.io/agents-hub/`.
2. **Environment protection (if the first deploy is rejected):** Settings → Environments → `github-pages` → allow the `main` branch.
3. **Let agents trigger deploys:** in each agent repo's workflow that calls agents-core's `run-agent.yml`, set `site_repo: Kghaffari26/agents-hub`, and add a `SITE_DISPATCH_TOKEN` secret there (a fine-grained PAT with **Contents: Read and write** on `Kghaffari26/agents-hub`, which is what `repository_dispatch` requires). Without it the 6-hourly schedule still picks up new data.
4. **Publish data:** once each agent's workflow has run and force-pushed its `data` branch, the next deploy uses it. The "Fetch agent data" step log (and the run's job summary) has a live/sample table with the reason for any fallback.
5. **Agent-side fixes (optional, see above):** none block live data; fix them in the agents when convenient, then drop the matching `TODO` tolerance here.
6. **Custom domain (optional):** set a `CUSTOM_DOMAIN` repo variable, add `public/CNAME`, and change `BASE_PATH`/`SITE_URL` in `deploy.yml` to `''` and your domain.
