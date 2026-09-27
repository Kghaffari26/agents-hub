# Case studies

## Detroit: a top mover explained by supply

**Run:** 2026-09-25 · **Trigger:** `top_mover` (median price +6.6% YoY) · **Cost:** $0.007

No metro raised a new major flag this week, so the investigator took the top mover. With a
budget of 8 model calls and $0.05 it called `get_metro_series`, `compare_to_peers`,
`get_national_context` and `find_similar_episodes`, then `finish`.

**Finding.** Inventory was down 6% and months of supply at 2.4 while sales fell 4.1%: fewer
listings, not more buyers, pushed prices up. The five closest Midwest peers rose 3.3% to 5.5%,
so Detroit leads a regional trend rather than standing alone.

**Guardrails that mattered.** `finish` rejects computed multiples ("twice the national rate"),
and every number goes through the number guard against the tools' outputs. Metrics the model
cited without looking at them are dropped from `cited_metrics`.
