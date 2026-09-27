# Real excerpts of the agentic additions

Published by the agent repos themselves (documentation excerpts or committed runs), copied verbatim:

| File | Source |
| --- | --- |
| `macro-latest-excerpt.json` | fed-agent `docs/demo/latest-excerpt.json` @ `37c6ffa` (schema 1.1.0, real run 2026-09-27): `investigation` (§6.1) |
| `macro-trace-excerpt.json` | fed-agent `docs/demo/trace-excerpt.json` @ `37c6ffa`: agents-core v0.3.0 `trace.json` |
| `spec-examples.json` | The JSON examples in real-estate-agent SPEC §6.3 (`a95534c`), sam-agent SPEC §6.3 (`095ca0b`) and repo-maintain-agent SPEC §6.1 (`bdf49cb`), comments stripped |
| `repo_maint-1.1.0/` | repo-maintain-agent's committed `public-data/` @ `bdf49cb`: a real schema 1.1.0 run on agents-core v0.3.0 (`latest.json` with `repos[].fix_proposals`, `trace.json`, `manifest-entry.json` with `trace_summary`) |

`test/unit/agentic/contracts.test.ts` checks the site's schemas read them. Replace them with full
runs in `test/fixtures/real/` once the agents publish `data` branches on agents-core v0.3.0.
