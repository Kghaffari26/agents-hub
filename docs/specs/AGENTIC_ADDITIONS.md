# Agentic additions: what the site reads

The agents gained agent loops, tracing and evals (agents-core v0.3.0; each agent spec's §6.x). This
file records the shapes **the site** reads, as built on 2026-09-27 while the agent repos were still
being upgraded. The zod source of truth is `src/lib/schemas/agentic.ts`; sample data comes from
`scripts/gen_agentic_fixtures.py`.

Rules for every field below:

- **Optional.** Older runs don't have them; the page section simply doesn't render (or says "no … yet").
- **Lenient.** On a §6 body the field is parsed with `lenient()` / `lenientArray()`: a malformed field
  (or array item) is dropped, never failing the agent. `fetch-data` validates them strictly as well
  (`AGENTIC_FIELDS`) and logs `"<file>: <field> doesn't match the documented shape at <path>"`.
- **Citations** accept `{ name, url }` (site style) or `{ source, url, note }` (agents-core `Citation`).
- **Stop reasons** are agents-core `LoopResult.stop_reason` values, shown in words; unknown ones verbatim.

## agents-core v0.3.0 (data branch)

| File / field | Shape | Shown in |
| --- | --- | --- |
| `trace.json` | agents-core `schema.Trace` exactly: `trace_schema_version` (1.x), `agent`, `run_id`, `summary`, `spans[]` (`id`, `parent_id`, `kind`, `name`, `started_at`, `duration_ms`, `status`, `error`, `attrs`), `truncated`, `dropped_spans`. Unknown span kinds read as `custom`. | Run trace panel (every agent page), fetched only when opened |
| `manifest-entry.json` → `trace_summary` | `{ steps, tool_calls, llm_calls, total_latency_ms, cost_usd, guard_retries }` or null | Run trace summary when `trace.json` is missing |

## Default branch (`main`)

| File | Shape | Shown in |
| --- | --- | --- |
| `evals/history.jsonl` | One agents-core `EvalReport.history_entry()` per line: `ts`, `suite`, `prompt_version`, `git_sha`, `model`, `scores` (0–1), `pass_rate`, `usd`, `n_cases`, … Also accepted: `date` for `ts`, `cost_usd` for `usd`; non-0–1 "scores" (e.g. `n`) are counts. Invalid lines are skipped and counted. | Evals section (agent pages, /about, /mcp for agents-mcp) |
| `docs/case-studies.md` | Markdown, ≤ 300 KB, rendered sanitized (no raw HTML); relative links resolve to the repo on GitHub, images to raw.githubusercontent.com. A leading `# Title` line is dropped. | /case-studies |

## §6.x fields

### real_estate — `latest.json` → `investigations[]`, `metros/<slug>.json` → `investigation` (SPEC_REAL_ESTATE §6.3, **published by real-estate-agent**, schema 1.1.0)

Adopted from real-estate-agent's spec and schema (checked 2026-09-27 at `a95534c`). Index entries
(`InvestigationSummary`): `{ slug, name, trigger (new_major_flag|top_mover), trigger_label, summary, cited_metrics[], narrative_source, stop_reason }`.
Metro file (`Investigation`, null when not investigated): `{ slug, name, trigger, trigger_flag?, trigger_label, explanation, cited_metrics[], narrative_source, model?, stop_reason, steps, tools_called[], cost_usd, prompt_version, generated_at, reused }`.
Up to 3 targets per run (new major flags, else the single top mover). /real-estate shows the summaries with each cited metric's
current value and YoY; the metro page shows the full explanation and tool calls. (1.1.0 also adds `alerts[].metros`, ignored for now.)

### macro — `latest.json` → `investigation` (SPEC_MACRO §6.1, **published by fed-agent**, schema 1.1.0)

Adopted verbatim from fed-agent's spec and exported schema (checked 2026-09-27 at `37c6ffa`):
`{ trigger: { event_id, type, indicator_id? }, analysis, cited_series: [{ id, name, fred_series, url }], narrative_source, model?, generated_at, reused_from_run_id?, loop?: { steps, tool_calls: string[], stop_reason, cost_usd, guard_attempts } }`.
One loop per run at most, on a new CPI/core PCE/payrolls/unemployment/GDP release or an FOMC decision; otherwise the previous
analysis is republished with `reused_from_run_id`. Shown as **What's driving this** on /macro. Real excerpts:
`test/fixtures/real-excerpts/`.

### grants — `latest.json` → `top_matches[].research` (SPEC_GRANTS §6.3, **published by sam-agent**, schema 1.1.0)

Adopted from sam-agent's spec and schema snapshot (checked 2026-09-27 at `095ca0b`):
`{ status (complete|partial), stop_reason, narrative_source, what_theyre_buying, evaluation_criteria[], likely_incumbent?, incumbent_notes, prior_awards: [{ award_id, recipient, amount, start_date, end_date, awarding_agency, url }], risks[], go_no_go (go|no_go), rationale, citations[] (agents-core Citation), tools_used[], steps, cost_usd, model, prompt_version, researched_at }`, or null.
Also `all.json` → `rows[].has_research`. Shown as a collapsed **Bid research** block in each top-match card, with
USAspending citations listed separately.

### repo_maint — `latest.json` → `repos[].fix_proposals[]` (SPEC_REPO_MAINT §6.1, **published by repo-maintain-agent**, schema 1.1.0)

Adopted from repo-maintain-agent's spec (checked 2026-09-27 at `bdf49cb`; a real 1.1.0 run is in `test/fixtures/real-excerpts/`):
`{ id, issue_number, issue_url, issue_title, status, reason?, summary, rationale?, narrative_source, diff?, files_changed[], lines_added, lines_removed, pr_url?, loop?: { steps, stop_reason, usd, tools_called[] }, model, proposed_at }`.
`proposed` renders as **Draft PR — awaiting human review** and `pr_opened` as "Draft PR opened — awaiting human review";
`no_fix`, `stopped`, `approval_blocked` and `failed` get their own labels (with `reason`), anything else verbatim.
