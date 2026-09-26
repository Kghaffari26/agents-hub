# CLAUDE.md — agents-hub

Static Next.js 15 site (App Router, `output: 'export'`) at the repo root. It hosts four agents whose data lives on each agent repo's `data` branch. Build spec: `docs/specs/SPEC_WEBSITE.md` (written for a monorepo — the multi-repo differences are recorded in `DECISIONS.md`). Agent JSON contracts: §6 of `docs/specs/SPEC_{REAL_ESTATE,MACRO,GRANTS,REPO_MAINT}.md`.

## Commands

- `npm run fetch-data` — assemble `public/data/` from data branches (per-agent fixture fallback, `sample: true`). `--offline` = fixtures only.
- `npm run dev` / `npm run build` — both assemble fixtures first if `public/data` is missing.
- `npm test -- --run` (Vitest) · `npm run e2e` (Playwright + axe on `out/`, served by `scripts/serve-out.mjs`) · `npm run lint` (eslint + prettier --check) · `npx tsc --noEmit`.
- `npm run gen:fixtures` regenerates `test/fixtures/` deterministically; then `node scripts/fetch-data.mjs --offline`.
- Reproduce Pages paths: `BASE_PATH=/agents-hub npm run build && BASE_PATH=/agents-hub npm run e2e`.

## Rules

- **Contracts:** `src/lib/schemas/*.ts` (hand-written zod matching each spec's §6) is what pages use. Never hand-edit `src/types/generated/` or `src/lib/validators/generated/` (written by `gen:types`). If an agent's contract changes, update the zod schema, the fixture generator, and the contract tests together.
- **Data URLs** only via `dataUrl()` / `assetUrl()` (`src/lib/data/url.ts`) — the site runs under `/agents-hub` on Pages.
- **Build-time data** only through `src/lib/data/server.ts` loaders (validate + clear errors). Client data through `useJson` / `fetchJson` (`src/lib/data/client.ts`).
- **Numbers:** format with `src/lib/format.ts`; missing → "—", never 0. Rate changes are pp, never %. Real-estate share metrics are 0–1 ratios (`{ isRatio: true }`).
- **Deltas** use `<Delta>` / `deltaTone` with the metric's good direction (agent value wins over `src/lib/metrics.ts`); never color alone.
- **Colors** come from CSS tokens in `src/app/globals.css`; charts read them with `useThemeColors()`.
- **Performance:** keep Recharts/Leaflet behind `next/dynamic` (`ssr: false`); don't pass long series from server components into client props. Budgets: `/` ≤ 120 KB, `/real-estate` ≤ 250 KB first-load JS (see `next build` output).
- **A11y:** axe (serious/critical) must pass in both themes; every control keyboard-reachable; charts need an `aria-label` summary and a data-table toggle.
- Never fail the build because an agent hasn't published — fall back to fixtures.
- Log non-obvious choices as one line in `DECISIONS.md`.
