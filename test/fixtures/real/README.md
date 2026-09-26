# Real agent output (contract fixtures)

Trimmed copies of real runs, validated by `test/contract/real-fixtures.test.ts`. Unlike
`test/fixtures/<agent>/` (synthetic, used as the site's sample data), these pin the shapes the
agents actually publish. Trimming (`scripts/trim_real_fixture.py`) only shortens arrays — series
to the last 24 points, 6 metros, 25 `all.json` rows — and never edits a value.

Folder name = agent id, optionally `<agent>__<variant>`.

| Folder | Source (all on agents-core v0.1.0, `schema_version` 1.0.0) |
| --- | --- |
| `real_estate` | `agents-run real_estate` against live Redfin/Zillow/FRED, 2026-09-26. Briefs reused from the agent's committed LLM brief cache (`narrative_source: llm`, no new calls). |
| `macro` | agents-core `runner.run` for `macro` against live FRED + federalreserve.gov, 2026-09-26; no-change day, so brief/FOMC read reused from the agent's committed state (`llm`). Run with an LLM stub that never got called. |
| `grants` | agents-core `runner.run` for `grants` against live SAM.gov + Grants.gov, 2026-09-26, with no LLM available: nothing scored, so `top_matches` is empty. |
| `grants__fake-llm` | Same live data from the HTTP cache, scored and summarized by the agent's own test `FakeClient` (`tests/grants/fakes.py`): real opportunities, synthetic scores/summaries and costs. Exercises `top_matches` and `deadlines_30d`. |
| `repo_maint` | The agent's committed `public-data/` (real report-mode run, 2026-09-26). Uses `narrative_source: "deterministic"` (tolerated, see STATUS.md). |

Refresh: run the agent, then `python3 scripts/trim_real_fixture.py <agent> <publish-dir> [<folder>]`
and `npx vitest --run test/contract`.
