# Case studies

## Who holds the VA cloud contract now?

**Run:** 2026-09-26 · **Opportunity:** Cloud Modernization Support Services (VA) · **Cost:** $0.030

A fit score says whether an opportunity matches the business; it doesn't say whether it's
winnable. For up to three **Pursue** matches a run, a research loop reads the notice and its
attachments and asks [USAspending](https://www.usaspending.gov/) for prior awards:
`get_opportunity`, `list_attachments`, `read_attachment`, `usaspending_prior_awards`.

It named the likely incumbent (a $4.87M award from 2021, ending 2026: this notice looks like
its recompete) and listed prior awards for similar work between $1.48M and $3.33M. The award
rows are copied from USAspending in code, and every award id the model mentions must have come
back from USAspending, so the brief can't invent one.

**Failure handled.** On another match the USAspending call timed out; the tool error went back
to the model as data, it retried once, and the loop finished inside its budget.
