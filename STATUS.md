# Status — agents-hub website

_Last updated 2026-09-26._

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

| Suite                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest (unit, component, contract) | **172 passed**, 14 files — formatters, mortgage math (incl. the $2,528.27 vector and the agent's own payments), colors/deltas, stale detection, URL state, CSV, metrics, loaders (corrupt file → error naming file + field; schema major mismatch), every fixture vs its zod schema + 2 broken fixtures, MetroPicker, AffordabilityCalc, LastUpdated, StatCard, StatementDiff, IndicatorCard, GrantsTable/filters/CSV, TopMatches, Repos components, page smoke tests                                            |
| Playwright e2e + axe               | **33 passed** (stable over 4 consecutive runs; also passes with `BASE_PATH=/agents-hub`) — every route renders with no console errors, overview cards + stale flip via clock, metro deep links + 404, theme toggle persistence, mobile nav, no horizontal scroll at 360px on any route, the full compare → URL → new-tab round trip incl. map click, calculator, macro diff/revisions/yield curve, grants filter → sort → CSV equals visible rows, repos sections; axe (serious/critical) on 7 routes × 2 themes |
| `npm run lint`                     | clean (eslint 0 problems, prettier clean) · `tsc --noEmit` clean                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npm run build`                    | succeeds; 57 HTML pages (6 routes + 50 metro pages + 404)                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

First-load JS (gzipped, from `next build`): `/` 111 KB (budget 120), `/real-estate` 141 KB (budget 250, map and chart in separate chunks), `/macro` 118 KB, `/grants` 146 KB, `/repos` 109 KB.

## Lighthouse (mobile, simulated slow 4G, local server with gzip like Pages)

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

## Known gaps

- **No agent has a `data` branch yet**, so every section currently shows committed sample data with a "Sample data" badge (`public/data/_fetch-report.json` records why for each agent). The site switches to live data automatically on the next deploy after an agent publishes.
- **Some agents' current output differs from their spec's §6**, and the site's contract is §6-exact (your rule), so those agents will keep showing sample data after they publish until they match:
  - `repo-maintain-agent`: its committed sample `public-data/repo_maint/latest.json` validates except `changelog.narrative_source: "deterministic"` (§6 and agents-core allow `"llm" | "template"`).
  - `fed-agent`: `schemas/macro.schema.json` has a stand-in `meta` (`run_id`, `generated_at`, `status`, `data_changed`, `warnings`) — no `schema_version`, `started_at`, `finished_at`, `cost_usd`, `model_usage`, `sources`.
  - `real-estate-agent`: its schema's `meta` lacks `schema_version`, `run_id`, `model_usage` and `sources` (has `stale`, `batch_fallback`, `warnings`).
  - `sam-agent`: `agents/grants/schema.py` uses a stand-in `Meta` (`generated_at`, `status: ok|error`) per its own note, pending agents-core.
    Once the agents adopt agents-core's `RunMeta`, these go away. If you'd rather accept small deviations, relax the enum/fields in `src/lib/schemas/*.ts` (and add a fixture for the variant).
- OSM tiles were blocked in the build sandbox, so map screenshots show markers without tiles; tiles load normally on the public site. For heavier traffic set `NEXT_PUBLIC_MAP_TILES` to a free-tier provider (OSM fair-use policy).
- Leaflet markers themselves aren't keyboard-focusable; the "View as table" fallback (tested) provides the same data and a Compare button per metro.
- Lighthouse CI in the workflow warns only (spec v1); `@next/bundle-analyzer` is not wired (sizes come from `next build`).
- `gen:types` output is not diff-checked in CI (it legitimately changes when an agent publishes a new schema).
- Relative times first render from the build time, then switch to the visitor's clock after hydration (avoids hydration mismatches).

## Steps for you

1. **Enable GitHub Pages:** repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. Then run the **Deploy site** workflow once (Actions → Deploy site → Run workflow), or push to `main`. The site will be at `https://kghaffari26.github.io/agents-hub/`.
2. **Environment protection (if the first deploy is rejected):** Settings → Environments → `github-pages` → allow the `main` branch.
3. **Let agents trigger deploys:** in each agent repo's workflow that calls agents-core's `run-agent.yml`, set `site_repo: Kghaffari26/agents-hub`, and add a `SITE_DISPATCH_TOKEN` secret there (a fine-grained PAT with **Contents: Read and write** on `Kghaffari26/agents-hub`, which is what `repository_dispatch` requires). Without it the 6-hourly schedule still picks up new data.
4. **Publish data:** once each agent's workflow has run and force-pushed its `data` branch, the next deploy uses it. Check `public/data/_fetch-report.json` in the workflow logs ("fetch-data" step) to see which agents are live vs sample and why.
5. **Contract alignment (optional, see Known gaps):** update the agents to emit their §6 shapes (or tell me to relax specific fields here).
6. **Custom domain (optional):** set a `CUSTOM_DOMAIN` repo variable, add `public/CNAME`, and change `BASE_PATH`/`SITE_URL` in `deploy.yml` to `''` and your domain.
