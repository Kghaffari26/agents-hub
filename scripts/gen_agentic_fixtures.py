#!/usr/bin/env python3
"""Sample fixtures for the agentic additions (agents-core v0.3.0 + each spec's §6.x).

Runs after gen_fixtures.py (which calls it) and reads the §6 fixtures it just wrote, so every
number in an investigation, driver, bid-research brief or fix proposal matches the sample
data on the page. Writes:

    test/fixtures/<agent>/trace.json                 agents-core `schema.Trace`
    test/fixtures/<agent>/manifest-entry.json        + trace_summary
    test/fixtures/real_estate/latest.json            + investigations[] (§6.3 summaries)
    test/fixtures/real_estate/metros/<slug>.json     + investigation (full; null elsewhere)
    test/fixtures/macro/latest.json                  + investigation (§6.1, fed-agent's real shape)
    test/fixtures/grants/latest.json                 + top_matches[].research (§6.3, sam-agent's shape)
    test/fixtures/repo_maint/latest.json             + fix_proposals[]
    test/fixtures/evals/<id>.jsonl                   evals/history.jsonl samples (+ agents_mcp)
    test/fixtures/case-studies/<id>.md               docs/case-studies.md samples

Shapes: docs/specs/AGENTIC_ADDITIONS.md. Deterministic (fixed dates, seeded RNG).
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "test" / "fixtures"
UTC = timezone.utc
RNG = random.Random(20260927)

HAIKU = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-5"
# $/MTok (input, output) — only used to make span costs add up plausibly.
PRICE = {HAIKU: (1.0, 5.0), SONNET: (3.0, 15.0)}


def load(p: Path):
    return json.loads(p.read_text())


def write(p: Path, obj) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n")


def parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def iso_ms(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def iso(dt: datetime) -> str:
    return dt.astimezone(UTC).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---- trace builder -------------------------------------------------------------------


class TraceBuilder:
    """Builds agents-core-shaped spans on a simulated clock (ms offsets from run start)."""

    def __init__(self, agent: str, run_id: str, started: datetime):
        self.agent, self.run_id, self.t0 = agent, run_id, started
        self.spans: list[dict] = []
        self.n = 0

    def span(self, kind, name, parent, start_ms, dur_ms, span_status="ok", error=None, **attrs):
        self.n += 1
        s = {
            "id": f"s{self.n}",
            "parent_id": parent["id"] if parent else None,
            "kind": kind,
            "name": name,
            "started_at": iso_ms(self.t0 + timedelta(milliseconds=start_ms)),
            "duration_ms": round(dur_ms, 3),
            "status": span_status,
            "error": error,
            "attrs": attrs,
        }
        self.spans.append(s)
        return s

    def llm(self, parent, start, name, model, tin, tout, *, tier="fast", purpose=None, cache_read=0, stop="end_turn", wait_ms=0):
        pin, pout = PRICE[model]
        usd = round((tin * pin + tout * pout + cache_read * pin * 0.1) / 1e6, 6)
        dur = 350 + tout * (9 if model == SONNET else 5) + RNG.randint(0, 250) + wait_ms
        self.span(
            "llm_call", name, parent, start, dur, tier=tier, model=model, purpose=purpose or name,
            estimated_usd=round(usd * 1.6, 6), input_tokens=tin, output_tokens=tout,
            cache_write_tokens=0, cache_read_tokens=cache_read, usd=usd, stop_reason=stop,
        )
        return start + dur, usd

    def http(self, parent, start, host, path, *, status=200, cached=False, retries=0, size=0):
        dur = (3 + RNG.random() * 6) if cached else (180 + RNG.random() * 900 + retries * 2000)
        attrs = {"method": "GET", "url": f"https://{host}{path}", "from_cache": cached, "status": status, "retries": retries}
        if not cached:
            attrs["bytes"] = size or RNG.randint(8_000, 900_000)
        self.span("http", f"GET {host}", parent, start, dur, **attrs)
        return start + dur

    def tool(self, parent, start, tool, step, inp, output, dur, *, is_error=False):
        self.span(
            "tool_call", tool, parent, start, dur, "error" if is_error else "ok",
            "ToolError: timed out after 10s" if is_error else None, tool=tool, step=step, input=inp,
            is_error=is_error, pending_approval=False, output=output[:200],
        )
        return start + dur

    def guard(self, parent, start, purpose, attempts, outcome, unsupported=None):
        self.span("guard", purpose, parent, start, 2 + attempts * 1.5, purpose=purpose, attempts=attempts,
                  outcome=outcome, unsupported=unsupported or [])
        return start + 3

    def finish(self):
        spans = self.spans
        roots = [s for s in spans if s["parent_id"] is None]
        summary = {
            "steps": int(sum(s["attrs"].get("steps", 0) for s in spans if s["kind"] == "agent_loop")),
            "tool_calls": sum(1 for s in spans if s["kind"] == "tool_call"),
            "llm_calls": sum(1 for s in spans if s["kind"] == "llm_call"),
            "total_latency_ms": round(sum(s["duration_ms"] for s in roots), 3),
            "cost_usd": round(sum(s["attrs"].get("usd", 0) for s in spans if s["kind"] == "llm_call"), 6),
            "guard_retries": int(sum(max(s["attrs"].get("attempts", 1) - 1, 0) for s in spans if s["kind"] == "guard")),
        }
        return {
            "trace_schema_version": "1.0.0",
            "agent": self.agent,
            "run_id": self.run_id,
            "summary": summary,
            "spans": spans,
            "truncated": False,
            "dropped_spans": 0,
        }


def agent_loop(tb: TraceBuilder, parent, start, purpose, model, turns, *, tier="smart"):
    """`turns`: list of lists of (tool, input, output, dur_ms, is_error) per model turn; the last
    turn calls `finish`. Returns (end_ms, usd, steps, tool_count)."""
    loop = tb.span("agent_loop", purpose, parent, start, 0, tier=tier, tools=sorted({t[0] for turn in turns for t in turn}))
    t = start + 1
    usd = 0.0
    ctx = 2400
    for step, calls in enumerate(turns, 1):
        t, u = tb.llm(loop, t, purpose, model, ctx, 160 + 40 * len(calls), tier=tier, purpose=purpose,
                      cache_read=max(ctx - 900, 0), stop="tool_use")
        usd += u
        ctx += 700
        for tool, inp, out, dur, err in calls:
            t = tb.tool(loop, t, tool, step, inp, out, dur, is_error=err)
    loop["duration_ms"] = round(t - start, 3)
    ncalls = sum(len(c) for c in turns)
    loop["attrs"].update(steps=len(turns), tool_calls=ncalls, pending_actions=0, stop_reason="finish", usd=round(usd, 6))
    return t, usd, len(turns), ncalls


def phases(tb: TraceBuilder, total_ms: float):
    run = tb.span("run", tb.agent, None, 0, total_ms, run_id=tb.run_id)
    return run


def scale_llm_costs(trace: dict, target: float) -> None:
    """Make llm_call usd add up to the run's published cost_usd (the page shows both)."""
    llm = [s for s in trace["spans"] if s["kind"] == "llm_call"]
    cur = sum(s["attrs"]["usd"] for s in llm)
    if not cur:
        return
    k = target / cur
    for s in llm:
        s["attrs"]["usd"] = round(s["attrs"]["usd"] * k, 6)
        s["attrs"]["estimated_usd"] = round(s["attrs"]["usd"] * 1.6, 6)
    loops = [s for s in trace["spans"] if s["kind"] == "agent_loop"]
    for lp in loops:
        lp["attrs"]["usd"] = round(sum(s["attrs"]["usd"] for s in llm if s["parent_id"] == lp["id"]), 6)
    trace["summary"]["cost_usd"] = round(sum(s["attrs"]["usd"] for s in llm), 6)


def with_trace_summary(agent_dir: Path, trace: dict) -> None:
    write(agent_dir / "trace.json", trace)
    m = load(agent_dir / "manifest-entry.json")
    m["trace_summary"] = trace["summary"]
    write(agent_dir / "manifest-entry.json", m)


def generic_trace(agent: str, latest: dict, fetch_hosts, analyze):
    meta = latest["meta"]
    t0, t1 = parse(meta["started_at"]), parse(meta["finished_at"])
    total = (t1 - t0).total_seconds() * 1000
    tb = TraceBuilder(agent, meta["run_id"], t0)
    run = phases(tb, total)
    # fetch
    fetch = tb.span("phase", "fetch", run, 5, 0)
    t = 6
    for host, path, cached, retries, status in fetch_hosts:
        t = tb.http(fetch, t, host, path, cached=cached, retries=retries, status=status)
    fetch["duration_ms"] = round(t - 5, 3)
    tr = tb.span("phase", "transform", run, t + 1, 0)
    t2 = t + 1 + 380 + RNG.random() * 400
    tr["duration_ms"] = round(t2 - (t + 1), 3)
    an = tb.span("phase", "analyze", run, t2 + 1, 0)
    t3 = analyze(tb, an, t2 + 2)
    an["duration_ms"] = round(t3 - (t2 + 1), 3)
    pub_start = t3 + 1
    pub = tb.span("phase", "publish", run, pub_start, 900 + RNG.random() * 700)
    # The trace measures itself: the run span ends when publish does (meta's finished_at also
    # covers schema export and git, which aren't traced).
    run["duration_ms"] = round(pub_start + pub["duration_ms"] + 5, 3)
    trace = tb.finish()
    scale_llm_costs(trace, meta["cost_usd"])
    return trace


# ---- real estate ---------------------------------------------------------------------


def build_real_estate() -> None:
    """SPEC_REAL_ESTATE §6.3 (real-estate-agent schema 1.1.0). Targets: metros with a new
    `major` flag, else the top mover (largest |median sale price YoY|). The fixtures have no
    major flags, so, as in a real quiet week, only the top mover is investigated."""
    base = OUT / "real_estate"
    latest = load(base / "latest.json")
    gen = latest["meta"]["finished_at"]
    metros = latest["metros"]
    top = max(metros, key=lambda m: abs(m["latest"]["median_sale_price"]["yoy"] or 0))
    mp = base / "metros" / f"{top['slug']}.json"
    d = load(mp)
    L = d["latest"]
    p, sold, inv, mos, dom = (L[k] for k in ("median_sale_price", "homes_sold", "inventory", "months_of_supply", "median_dom"))
    # compare_to_peers: the 5 metros closest by homes_sold_12m in the same Census region.
    midwest = {"chicago-il", "minneapolis-mn", "columbus-oh", "indianapolis-in", "kansas-city-mo", "st-louis-mo",
               "cincinnati-oh", "cleveland-oh", "milwaukee-wi", "detroit-mi", "warren-mi"}
    region = [m for m in metros if m["slug"] != top["slug"] and (m["slug"] in midwest or top["slug"] not in midwest)]
    size = top.get("homes_sold_12m") or 0
    peers = sorted(region, key=lambda m: abs((m.get("homes_sold_12m") or 0) - size))[:5]
    peer_yoy = sorted(m["latest"]["median_sale_price"]["yoy"] for m in peers)
    nat = latest["national"]["latest"]["median_sale_price"]["yoy"]
    pct = lambda x, nd=1: f"{x * 100:+.{nd}f}%"  # noqa: E731
    label = f"Median price {pct(p['yoy'])} YoY"
    explanation = (
        f"{top['name']}'s median sale price is ${p['value']:,.0f}, {pct(p['yoy'])} from a year ago, while the national "
        f"median is {pct(nat)}. Supply is the main reason: active inventory is {pct(inv['yoy'], 0)} YoY and months of supply "
        f"is {mos['value']:.1f}. Sales are {pct(sold['yoy'])} YoY and the median home sells in {dom['value']} days, so fewer "
        f"listings, not more buyers, are pushing prices up. Its five closest Midwest peers by sales volume saw price changes between "
        f"{pct(peer_yoy[0])} and {pct(peer_yoy[-1])}, so {top['name'].split(',')[0]} is at the top of a regional trend rather "
        "than an outlier."
    )
    cited = ["median_sale_price", "inventory", "months_of_supply", "homes_sold", "median_dom"]
    tools = ["get_metro_series", "compare_to_peers", "get_national_context", "find_similar_episodes"]
    full = {
        "slug": top["slug"], "name": top["name"], "trigger": "top_mover", "trigger_flag": None, "trigger_label": label,
        "explanation": explanation, "cited_metrics": cited, "narrative_source": "llm", "model": HAIKU,
        "stop_reason": "finished", "steps": 5, "tools_called": tools, "cost_usd": 0.0071,
        "prompt_version": "investigator-2026-09-27.4", "generated_at": gen, "reused": False,
    }
    d["investigation"] = full
    write(mp, d)
    for m_path in (base / "metros").glob("*.json"):
        if m_path != mp:
            md = load(m_path)
            md["investigation"] = None
            write(m_path, md)
    latest["investigations"] = [{
        "slug": top["slug"], "name": top["name"], "trigger": "top_mover", "trigger_label": label,
        "summary": explanation.split(". ")[0] + ".", "cited_metrics": cited, "narrative_source": "llm",
        "stop_reason": "finished",
    }]
    write(base / "latest.json", latest)

    def analyze(tb, an, t):
        # 12 metros changed enough to need a new brief (the rest came from the LLM cache).
        for slug in ["tampa-fl", "austin-tx", "denver-co", "orlando-fl", "miami-fl", "san-antonio-tx", "raleigh-nc",
                     "chicago-il", "boston-ma", "detroit-mi", "jacksonville-fl", "cape-coral-fl"]:
            t, _ = tb.llm(an, t, f"metro brief {slug}", HAIKU, 1400, 190, purpose="metro_brief")
            tb.guard(an, t, "metro_brief", 2 if slug == "raleigh-nc" else 1, "retried_ok" if slug == "raleigh-nc" else "ok")
            t += 3
        t, _ = tb.llm(an, t, "national brief", SONNET, 5400, 610, tier="smart", purpose="national_brief")
        tb.guard(an, t, "national_brief", 1, "ok")
        t += 3
        s = top["slug"]
        turns = [
            [("get_metro_series", {"slug": s, "metrics": ["median_sale_price", "inventory", "homes_sold"], "months": 24}, "24 rows…", 4, False)],
            [("compare_to_peers", {"slug": s, "metric": "median_sale_price"}, "5 Midwest peers…", 3, False)],
            [("get_national_context", {"series": ["median_sale_price", "inventory"]}, "US median…", 2, False)],
            [("find_similar_episodes", {"slug": s, "metric": "months_of_supply"}, "no similar episode in 36 months", 3, False)],
            [("finish", {"cited_metrics": cited}, "ok", 1, False)],
        ]
        t, *_ = agent_loop(tb, an, t, f"investigate {s}", HAIKU, turns, tier="fast")
        tb.guard(an, t, f"investigate {s}:finish", 1, "ok")
        return t + 4

    hosts = [("redfin-public-data.s3.us-west-2.amazonaws.com", "/redfin_market_tracker/redfin_metro_market_tracker.tsv000.gz", False, 0, 200),
             ("files.zillowstatic.com", "/research/public_csvs/zhvi/Metro_zhvi.csv", False, 0, 200),
             ("files.zillowstatic.com", "/research/public_csvs/zori/Metro_zori.csv", True, 0, 200),
             ("api.stlouisfed.org", "/fred/series/observations?series_id=MORTGAGE30US&api_key=***", False, 0, 200),
             ("api.stlouisfed.org", "/fred/series/observations?series_id=MORTGAGE15US&api_key=***", False, 1, 200),
             ("api.stlouisfed.org", "/fred/series/observations?series_id=HOUST&api_key=***", True, 0, 200),
             ("www2.census.gov", "/econ/bps/Metro/ma2608c.txt", False, 0, 200)]
    with_trace_summary(base, generic_trace("real_estate", latest, hosts, analyze))


# ---- macro ---------------------------------------------------------------------------


def build_macro() -> None:
    """SPEC_MACRO §6.1 `investigation` (fed-agent schema 1.1.0): one loop per run, on the top
    high-priority event. Here the FOMC cut, with the loop reading CPI, core CPI and unemployment."""
    base = OUT / "macro"
    latest = load(base / "latest.json")
    gen = latest["meta"]["finished_at"]
    ind = {i["id"]: i for i in latest["indicators"]}
    cpi, core, unrate, pay = (ind[k] for k in ("cpi", "core_cpi", "unrate", "payrolls"))
    ev = next(e for e in latest["events"] if e["type"] == "fomc_decision")
    f = ev["facts"]
    analysis = (
        f"The FOMC cut its target range by {abs(f['change_bp'])}bp to {f['lower']:.2f}-{f['upper']:.2f}% on "
        f"{ev['id'].split(':')[1]}, the first move after holding since last December. Headline CPI inflation "
        f"rose to {cpi['primary']['value']}% in {cpi['period_label']} from 2.7% while core held at "
        f"{core['primary']['value']}%, so the cut was not a response to cooling prices. The labor data explain it: "
        f"payrolls grew only {pay['primary']['value']}K in {pay['period_label']} and unemployment rose to "
        f"{unrate['primary']['value']}%, the highest since 2021."
    )
    fred = lambda i: {"id": i["id"], "name": i["name"], "fred_series": i["fred_series"], "url": i["source_url"]}  # noqa: E731
    tool_calls = ["get_fomc_context", "get_series", "get_series", "get_components", "get_series", "percentile_vs_history"]
    inv = {
        "trigger": {"event_id": ev["id"], "type": "fomc_decision", "indicator_id": None},
        "analysis": analysis,
        "cited_series": [fred(cpi), fred(core), fred(pay), fred(unrate)],
        "narrative_source": "llm",
        "model": SONNET,
        "generated_at": gen,
        "reused_from_run_id": None,
        "loop": {"steps": 4, "tool_calls": tool_calls, "stop_reason": "finished", "cost_usd": 0.0112, "guard_attempts": 2},
    }
    latest["investigation"] = inv
    write(base / "latest.json", latest)

    def analyze(tb, an, t):
        t, _ = tb.llm(an, t, "what changed brief", SONNET, 6120, 540, tier="smart", purpose="brief")
        tb.guard(an, t, "brief", 1, "ok")
        t += 3
        t, _ = tb.llm(an, t, "fomc read", SONNET, 4800, 420, tier="smart", purpose="fomc_read")
        tb.guard(an, t, "fomc_read", 1, "ok")
        t += 3
        outputs = {
            "get_fomc_context": "target 4.00-4.25, change_bp -25, votes 11-1…",
            "get_series": "24 monthly values…",
            "get_components": "shelter 3.6 YoY, energy 1.9 YoY…",
            "percentile_vs_history": "percentile 88 over 5y…",
        }
        args = [{}, {"id": "cpi", "range": "2y"}, {"id": "core_cpi", "range": "2y"}, {"release": "cpi"},
                {"id": "unrate", "range": "2y"}, {"id": "unrate", "value": unrate["primary"]["value"], "years": 5}]
        calls = [(n, a, outputs[n], 4, False) for n, a in zip(tool_calls, args)]
        turns = [calls[0:1], calls[1:3], calls[3:6], [("finish", {}, "ok", 1, False)]]
        t, *_ = agent_loop(tb, an, t, "release investigation", SONNET, turns)
        # First draft said "highest since 2020"; the guard sent it back once.
        tb.guard(an, t, "release investigation:finish", 2, "retried_ok", ["2020"])
        return t + 4

    hosts = [("api.stlouisfed.org", f"/fred/series/observations?series_id={s}&api_key=***", s in ("GDPC1", "UMCSENT"), 0, 200)
             for s in ("CPIAUCSL", "CPILFESL", "PCEPI", "UNRATE", "PAYEMS", "ICSA", "GDPC1", "DGS10", "DGS2", "UMCSENT")]
    hosts += [("www.federalreserve.gov", "/monetarypolicy/fomccalendars.htm", True, 0, 200),
              ("api.stlouisfed.org", "/fred/series/observations?series_id=T10Y2Y&api_key=***", False, 2, 200)]
    with_trace_summary(base, generic_trace("macro", latest, hosts, analyze))


# ---- grants --------------------------------------------------------------------------


def money(x: float) -> str:
    return f"${x / 1e6:.1f}M" if x >= 1e6 else f"${x / 1e3:,.0f}K"


def usas(award_id: str) -> str:
    return f"https://www.usaspending.gov/award/{award_id}"


def build_grants() -> None:
    base = OUT / "grants"
    latest = load(base / "latest.json")
    gen = latest["meta"]["finished_at"]
    tops = latest["top_matches"]
    research = {
        "Cloud Modernization Support Services": {
            "incumbent": {"recipient": "Liberty IT Solutions LLC", "amount": 4_870_000, "award_date": "2021-11-03",
                          "agency": "Department of Veterans Affairs", "award_id": "CONT_AWD_36C10B22F0017_3600_NNG15SD27B_8000",
                          "description": "Cloud migration and O&M support, OIT", "url": usas("CONT_AWD_36C10B22F0017_3600_NNG15SD27B_8000")},
            "similar": [
                ("Oddball Inc.", 2_140_000, "2024-03-18", "CONT_AWD_36C10B24F0203_3600_47QTCA20D0028_4732"),
                ("Ad Hoc LLC", 3_325_000, "2023-09-27", "CONT_AWD_36C10B23F0391_3600_36C10B21A0010_3600"),
                ("Agile Six Applications Inc.", 1_480_000, "2025-06-02", "CONT_AWD_36C10B25F0118_3600_47QTCA22D00BB_4732"),
            ],
            "price": (1_400_000, 2_600_000, "Median of 3 comparable VA OIT task orders, 2023–2025, scaled to a 12-month base period"),
            "competition": "Incumbent is a large SDVOSB; the three comparable awards went to small agile shops through GSA MAS, so a small-business set-aside is competitive.",
            "questions": ["Is the incumbent's contract being recompeted or extended?", "Will VA accept a teaming arrangement with an SDVOSB?"],
            "confidence": "high",
        },
        "Web Application Accessibility Remediation": {
            "incumbent": None,
            "similar": [
                ("Bixal Solutions Inc.", 612_000, "2024-08-29", "CONT_AWD_12314424F0144_1231_47QTCA19D00MV_4732"),
                ("TPGi LLC", 248_500, "2025-02-11", "CONT_AWD_12505B25P0027_12C2_-NONE-_-NONE-"),
            ],
            "price": (240_000, 620_000, "Two USDA accessibility awards, 2024–2025"),
            "competition": "No incumbent found for this office; prior USDA accessibility work went to specialist firms at modest values.",
            "questions": ["How many applications are in scope?"],
            "confidence": "medium",
        },
        "Research Data Pipeline Development": {
            "incumbent": {"recipient": "Kitware Inc.", "amount": 395_000, "award_date": "2023-07-14",
                          "agency": "Small Business Administration", "award_id": "CONT_AWD_73351023P0081_7300_-NONE-_-NONE-",
                          "description": "Data pipeline and reporting support, Office of Advocacy", "url": usas("CONT_AWD_73351023P0081_7300_-NONE-_-NONE-")},
            "similar": [
                ("Kitware Inc.", 395_000, "2023-07-14", "CONT_AWD_73351023P0081_7300_-NONE-_-NONE-"),
                ("Fearless Solutions LLC", 520_000, "2024-09-20", "CONT_AWD_73351024F0112_7300_47QTCA21D003X_4732"),
            ],
            "price": (400_000, 520_000, "Incumbent value and one comparable SBA award; the notice estimates $450K"),
            "competition": "Small incumbent with a 3-year-old award; the notice's $450K estimate sits between the two prior awards.",
            "questions": ["Is Kitware's award in its final option year?"],
            "confidence": "medium",
        },
    }
    buying = {
        "Cloud Modernization Support Services": "Migration of VA OIT legacy applications to VA Enterprise Cloud (AWS GovCloud), plus 12 months of operations and maintenance for the migrated systems.",
        "Web Application Accessibility Remediation": "Section 508 / WCAG 2.1 AA audits and remediation for USDA public web applications, with a testing report per application.",
        "Research Data Pipeline Development": "A data pipeline and reporting layer for the Office of Advocacy's small-business research datasets.",
    }
    criteria = {
        "Cloud Modernization Support Services": ["Technical Approach", "Management Plan", "Past Performance", "Price"],
        "Web Application Accessibility Remediation": ["Technical Approach", "Past Performance", "Price"],
        "Research Data Pipeline Development": ["Technical Approach", "Key Personnel", "Past Performance", "Price"],
    }
    for m in tops:
        r = research.get(m["title"])
        if not r or m["recommendation"] != "Pursue":
            continue
        inc = r["incumbent"]
        awards = []
        rows = ([(inc["recipient"], inc["amount"], inc["award_date"], inc["award_id"])] if inc else []) + r["similar"]
        for who, amt, dt, aid in rows:
            if any(a["url"] == usas(aid) for a in awards):
                continue
            y = int(dt[:4])
            awards.append({"award_id": aid.split("_")[2], "recipient": who.upper(), "amount": float(amt),
                           "start_date": dt, "end_date": f"{y + (5 if inc and aid == inc['award_id'] else 3)}{dt[4:]}",
                           "awarding_agency": m["agency"].title(), "url": usas(aid)})
        low, high, _basis = r["price"]
        cites = [{"source": "SAM.gov", "url": m["url"], "note": "The notice"}]
        if m["source"] == "sam":
            cites.append({"source": "SAM.gov", "url": m["url"], "note": "Attachment: Performance Work Statement (PDF)"})
        cites += [{"source": "USAspending.gov", "url": a["url"], "note": f"Prior award {a['award_id']}"} for a in awards]
        inc_name = inc["recipient"].upper() if inc else None
        m["research"] = {
            "status": "complete",
            "stop_reason": "finished",
            "narrative_source": "llm",
            "what_theyre_buying": buying[m["title"]],
            "evaluation_criteria": criteria[m["title"]],
            "likely_incumbent": inc_name,
            "incumbent_notes": (
                f"{inc_name} holds award {awards[0]['award_id']} ({money(inc['amount'])}, {inc['award_date'][:4]}), ending "
                f"{awards[0]['end_date'][:4]}; this notice looks like its recompete." if inc else
                "USAspending shows no prior award from this office for the same work; comparable awards went to specialist firms."
            ),
            "prior_awards": awards,
            "risks": [r["competition"], r["questions"][0].rstrip("?") + ": not answered in the notice."],
            "go_no_go": "go",
            "rationale": (
                f"The scope matches the profile's core services and the set-aside is open to us; prior awards for similar "
                f"work ran {money(low)}–{money(high)}, within the profile's size range."
            ),
            "citations": cites,
            "tools_used": (["get_opportunity", "list_attachments", "read_attachment"] if m["source"] == "sam"
                           else ["get_opportunity", "grants_gov_detail"]) + ["usaspending_prior_awards"],
            "steps": 4,
            "cost_usd": 0.0301 if m["source"] == "sam" else 0.0187,
            "model": SONNET,
            "prompt_version": "v1",
            "researched_at": gen,
        }
    write(base / "latest.json", latest)

    def analyze(tb, an, t):
        # Batch scoring shows as one long llm_call; then per-match summaries and bid research.
        # Message Batches API: most of the wall time is waiting for the batch to finish.
        t, _ = tb.llm(an, t, "score batch (38 opportunities)", HAIKU, 61_000, 9_400, purpose="score_batch", wait_ms=1_140_000)
        for m in tops[:8]:
            t, _ = tb.llm(an, t, f"summary {m['id'][:18]}", SONNET, 2100, 320, tier="smart", purpose="match_summary")
            tb.guard(an, t, "match_summary", 1, "ok")
            t += 3
        for m in tops:
            rs = m.get("research")
            if not rs:
                continue
            calls = [(tool, {"id": m["id"][:18]}, f"{tool} ok", {"read_attachment": 2400, "usaspending_prior_awards": 900}.get(tool, 300), False)
                     for tool in rs["tools_used"]]
            turns = [calls[:1], calls[1:-1], calls[-1:], [("finish", {}, "ok", 1, False)]]
            if m["title"].startswith("Web"):
                # USAspending timed out once; the error went back to the model, which retried.
                turns.insert(2, [("usaspending_prior_awards", {"id": m["id"][:18]}, "ToolError: timed out after 10s", 10_000, True)])
            t, *_ = agent_loop(tb, an, t, f"bid research {m['id'][:18]}", SONNET, turns)
            tb.guard(an, t, "research:finish", 1, "ok")
            t += 4
        return t

    hosts = [("api.sam.gov", "/opportunities/v2/search?postedFrom=09/25/2026&api_key=***", False, 0, 200),
             ("api.sam.gov", "/opportunities/v2/search?postedFrom=09/25/2026&offset=1000&api_key=***", False, 1, 200),
             ("api.sam.gov", "/prod/opportunities/v1/noticedesc?noticeid=174ece4d&api_key=***", True, 0, 200),
             ("apply07.grants.gov", "/grantsws/rest/opportunities/search", False, 0, 200),
             ("api.usaspending.gov", "/api/v2/search/spending_by_award/", False, 0, 200),
             ("api.usaspending.gov", "/api/v2/awards/CONT_AWD_36C10B22F0017/", False, 0, 200)]
    with_trace_summary(base, generic_trace("grants", latest, hosts, analyze))


# ---- repo maintenance ----------------------------------------------------------------

CSV_DIFF = '''diff --git a/src/lib/csv.ts b/src/lib/csv.ts
index 4c1e2a9..8f03b7d 100644
--- a/src/lib/csv.ts
+++ b/src/lib/csv.ts
@@ -8,9 +8,12 @@ export type Row = Record<string, string | number | null>;
 /** Quote a field for RFC 4180 CSV. */
 export function csvField(v: string | number | null): string {
   if (v == null) return '';
   const s = String(v);
-  return /[",\\n]/.test(s) ? `"${s}"` : s;
+  // Double embedded quotes (RFC 4180 §2.7); quote fields with a comma, quote, CR or LF.
+  return /[",\\r\\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
 }

 export function toCsv(rows: Row[], columns: string[]): string {
diff --git a/test/csv.test.ts b/test/csv.test.ts
index 0a5d311..d2c94e0 100644
--- a/test/csv.test.ts
+++ b/test/csv.test.ts
@@ -14,4 +14,12 @@ describe('csvField', () => {
   it('quotes commas', () => {
     expect(csvField('a,b')).toBe('"a,b"');
   });
+
+  it('doubles embedded quotes', () => {
+    expect(csvField('The "Best" Grant')).toBe('"The ""Best"" Grant"');
+  });
+
+  it('quotes carriage returns', () => {
+    expect(csvField('a\\rb')).toBe('"a\\rb"');
+  });
 });
'''



def diff_stats(diff: str):
    files, cur = [], None
    for line in diff.splitlines():
        if line.startswith("diff --git"):
            cur = {"path": line.split(" b/", 1)[1], "additions": 0, "deletions": 0}
            files.append(cur)
        elif cur and line.startswith("+") and not line.startswith("+++"):
            cur["additions"] += 1
        elif cur and line.startswith("-") and not line.startswith("---"):
            cur["deletions"] += 1
    return files


def build_repo_maint() -> None:
    base = OUT / "repo_maint"
    latest = load(base / "latest.json")
    gen = latest["meta"]["finished_at"]
    by_repo = {r["full_name"]: r for r in latest["repos"]}

    sandbox = by_repo["Kghaffari26/agents-hub-sandbox"]
    url = sandbox["url"]
    stats = diff_stats(CSV_DIFF)
    proposals = [
        {
            "id": "7c41e09a2b3f",
            "issue_number": 77,
            "issue_url": f"{url}/issues/77",
            "issue_title": "CSV export drops quotes in titles",
            "status": "proposed",
            "reason": None,
            "summary": ("`csvField` wrapped fields containing quotes but didn't double the embedded ones, so a title "
                        "like `The \"Best\" Grant` broke the row. The patch doubles embedded quotes and adds two tests."),
            "rationale": "RFC 4180 requires embedded double quotes to be escaped by doubling them.",
            "narrative_source": "llm",
            "diff": CSV_DIFF,
            "files_changed": [f["path"] for f in stats],
            "lines_added": sum(f["additions"] for f in stats),
            "lines_removed": sum(f["deletions"] for f in stats),
            "pr_url": None,
            "loop": {"steps": 5, "stop_reason": "finished", "usd": 0.0129,
                     "tools_called": ["search_code", "read_file", "read_file", "propose_patch"]},
            "model": SONNET,
            "proposed_at": gen,
        },
        {
            "id": "e5a90d17c6b2",
            "issue_number": 78,
            "issue_url": f"{url}/issues/78",
            "issue_title": "Map doesn't render on Safari 17",
            "status": "no_fix",
            "reason": None,
            "summary": "The map container gets zero height on Safari 17 before the stylesheet loads; a fix needs a layout change across several components, beyond a small, safe patch.",
            "rationale": None,
            "narrative_source": "llm",
            "diff": None,
            "files_changed": [],
            "lines_added": 0,
            "lines_removed": 0,
            "pr_url": None,
            "loop": {"steps": 4, "stop_reason": "finished", "usd": 0.0094,
                     "tools_called": ["search_code", "read_file", "list_files"]},
            "model": SONNET,
            "proposed_at": gen,
        },
    ]
    for r in latest["repos"]:
        r["fix_proposals"] = proposals if r is sandbox else []
    write(base / "latest.json", latest)

    def analyze(tb, an, t):
        for r in latest["repos"]:
            for it in r["triage"]:
                if it.get("cached"):
                    continue
                t, _ = tb.llm(an, t, f"triage {r['full_name'].split('/')[1]}#{it['number']}", HAIKU, 1800, 240, purpose="triage")
        for r in latest["repos"]:
            if r.get("changelog") and not r["changelog"].get("cached"):
                t, _ = tb.llm(an, t, f"changelog {r['full_name'].split('/')[1]}", SONNET, 3100, 420, tier="smart", purpose="changelog")
                tb.guard(an, t, "changelog", 1, "ok")
                t += 3
        for p in proposals:
            turns = [[(tool, {"issue": p["issue_number"]}, f"{tool} ok", 120, False)] for tool in p["loop"]["tools_called"]]
            turns.append([("finish", {"outcome": "patch" if p["diff"] else "no_fix"}, "ok", 1, False)])
            t, *_ = agent_loop(tb, an, t, f"fix agents-hub-sandbox#{p['issue_number']}", SONNET, turns)
            tb.guard(an, t, "fix_summary", 1, "ok")
            t += 3
        return t

    hosts = []
    for r in latest["repos"]:
        name = r["full_name"]
        hosts += [("api.github.com", f"/repos/{name}/issues?state=open", True, 0, 304),
                  ("api.github.com", f"/repos/{name}/pulls?state=open", False, 0, 200)]
    with_trace_summary(base, generic_trace("repo_maint", latest, hosts, analyze))


# ---- evals history -------------------------------------------------------------------


def eval_history(suites: dict, *, start="2026-08-01", weeks=9, model=SONNET, sha_seed=0, mcp=False):
    """suites: name -> {score: (start, end)}. Weekly entries with a gentle trend, noise and one dip."""
    out = []
    d0 = datetime.fromisoformat(start).replace(tzinfo=UTC, hour=16)
    rng = random.Random(sha_seed)
    for w in range(weeks):
        ts = d0 + timedelta(days=7 * w)
        sha = f"{rng.getrandbits(28):07x}"
        for suite, scores in suites.items():
            vals = {}
            for k, (a, b) in scores.items():
                v = a + (b - a) * (w / (weeks - 1)) + rng.uniform(-0.02, 0.02)
                if w == 5:  # a prompt change regressed, fixed the next week
                    v -= 0.07
                vals[k] = round(min(max(v, 0.0), 1.0), 3)
            if mcp:
                out.append({"date": ts.date().isoformat(), "git_sha": sha, "model": "claude-opus-5",
                            "scores": {"n": 25, **vals}, "cost_usd": round(0.18 + rng.random() * 0.05, 4)})
                continue
            n = 24 if "judge" not in " ".join(scores) else 12
            pass_rate = round(min(vals.values()) - 0.03, 3)
            out.append({
                "ts": iso(ts + timedelta(minutes=list(suites).index(suite) * 3)),
                "suite": suite,
                "prompt_version": (d0 + timedelta(days=7 * (w - w % 3))).date().isoformat(),
                "git_sha": sha,
                "model": model,
                "scores": vals,
                "pass_rate": max(pass_rate, 0.0),
                "usd": round(0.04 + rng.random() * 0.12, 4),
                "n_cases": n,
                "n_scored": n,
                "budget_exhausted": False,
            })
    return out


def build_evals() -> None:
    base = OUT / "evals"
    sets = {
        "real_estate": eval_history({
            "investigations": {"required_tools_called": (0.83, 0.96), "finding_supported": (0.71, 0.88), "numbers_grounded": (0.9, 0.99)},
            "metro_briefs": {"number_guard_pass": (0.92, 0.98), "style": (0.8, 0.9)},
        }, sha_seed=1),
        "macro": eval_history({
            "release_investigation": {"factor_grounding": (0.68, 0.86), "citations_resolve": (0.9, 0.98), "llm_judge": (0.62, 0.8)},
            "fomc_read": {"tone_exact": (0.75, 0.88)},
        }, sha_seed=2),
        "grants": eval_history({
            "fit_scoring": {"recommendation_exact": (0.7, 0.83), "fit_within_10": (0.74, 0.9)},
            "research": {"incumbent_found": (0.66, 0.88), "citations_resolve": (0.92, 1.0), "llm_judge": (0.6, 0.78)},
        }, sha_seed=3),
        "repo_maint": eval_history({
            "triage": {"classification_exact": (0.78, 0.9), "labels_overlap": (0.7, 0.84)},
            "fix_proposer": {"tests_pass": (0.55, 0.8), "diff_applies": (0.85, 0.97), "forbidden_tools_not_called": (1.0, 1.0)},
        }, sha_seed=4),
        "agents_mcp": eval_history({"tool_selection": {"tool_accuracy": (0.88, 1.0), "arg_accuracy": (0.84, 1.0), "fully_correct": (0.8, 1.0)}},
                                   weeks=5, start="2026-08-29", sha_seed=5, mcp=True),
    }
    for k, rows in sets.items():
        p = base / f"{k}.jsonl"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("".join(json.dumps(r, separators=(",", ":")) + "\n" for r in rows))


# ---- case studies --------------------------------------------------------------------

CASE_STUDIES = {
    "real_estate": """# Case studies

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
""",
    "macro": """# Case studies

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
""",
    "grants": """# Case studies

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
""",
    "repo_maint": """# Case studies

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
""",
}


def build_case_studies() -> None:
    base = OUT / "case-studies"
    base.mkdir(parents=True, exist_ok=True)
    for k, md in CASE_STUDIES.items():
        (base / f"{k}.md").write_text(md)


def main() -> None:
    build_real_estate()
    build_macro()
    build_grants()
    build_repo_maint()
    build_evals()
    build_case_studies()
    print("agentic fixtures written (trace.json ×4, §6.x fields, evals/, case-studies/)")


if __name__ == "__main__":
    main()
