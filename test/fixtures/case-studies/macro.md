# Case studies

## The September cut: "what's driving this"

**Run:** 2026-09-25 · **Trigger:** `fomc_decision:2026-09-16` · **Cost:** $0.011

The FOMC cut by 25bp while headline CPI rose to 2.9%. The brief could say both facts but not why they
fit together, so the release investigator ran: `get_fomc_context`, CPI and core CPI series,
`get_components` for CPI, the unemployment series and `percentile_vs_history`, then `finish`.

**Finding.** Inflation wasn't cooling; the labor data explain the cut (payrolls +22K, unemployment
4.4%). Only the four series a tool actually returned are cited, attached by code.

## When the guard said no

The first draft called 4.4% unemployment "the highest since 2020". No tool had returned that
comparison, so the number guard sent the draft back with the unsupported number named; the second
draft passed. The trace shows both guard attempts.
