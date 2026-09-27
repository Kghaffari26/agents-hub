# Case studies

## From a bug report to a proposal a human can approve

**Issue:** agents-hub-sandbox#77 "CSV export drops quotes in titles" · **Cost:** $0.013

Triage classified #77 as a high-confidence bug with steps to reproduce, small enough for the fix
proposer. The loop searched for `csvField`, read two files and called `propose_patch`, which
applied the diff in memory to check it (at most 3 files and 80 changed lines, nothing under
`.github/`). The proposal was published as **Draft PR — awaiting human review**, with the diff.

The model has no write tool. A maintainer approves proposal `7c41e09a2b3f` by id in an apply-mode
run; only then does the agent re-apply the stored diff on the current default branch and open a
**draft** PR with a human-review banner. It never merges.

## Knowing when not to patch

For #78 ("Map doesn't render on Safari 17") the loop read the map components and finished with
`no_fix`: the fix needs a layout change across several files, beyond a small, safe patch. That
outcome is published too, so nobody waits for a PR that isn't coming.
