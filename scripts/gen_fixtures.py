#!/usr/bin/env python3
"""Generate realistic, deterministic fixtures for all four agents.

Output mirrors each agent's `data` branch root (see agents-core README):

    test/fixtures/<agent>/latest.json
    test/fixtures/<agent>/history/YYYY-MM-DD.json
    test/fixtures/<agent>/manifest-entry.json
    test/fixtures/<agent>/costs-summary.json
    test/fixtures/real_estate/metros/<slug>.json
    test/fixtures/grants/all.json

Shapes follow §6 of SPEC_REAL_ESTATE / SPEC_MACRO / SPEC_GRANTS / SPEC_REPO_MAINT
exactly. Numbers are synthetic but internally consistent (YoY values are computed
from the published series, temperature is z-scored across metros, payments use the
same amortization formula as the site). Run: `npm run gen:fixtures`.
"""

from __future__ import annotations

import calendar
import json
import math
import random
import shutil
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "test" / "fixtures"
RNG = random.Random(20260926)
UTC = timezone.utc


def iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def month_end(y: int, m: int) -> date:
    return date(y, m, calendar.monthrange(y, m)[1])


def add_months(y: int, m: int, k: int) -> tuple[int, int]:
    idx = y * 12 + (m - 1) + k
    return idx // 12, idx % 12 + 1


def write(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n")


def payment(principal: float, annual_rate_pct: float, years: int) -> float:
    n = years * 12
    r = annual_rate_pct / 100 / 12
    if r == 0:
        return principal / n
    f = (1 + r) ** n
    return principal * r * f / (f - 1)


def meta(agent: str, started: datetime, secs: int, cost: float, sources, fast=(0, 0), smart=(0, 0), extra=None, data_changed=True, status="ok"):
    m = {
        "agent": agent,
        "schema_version": "1.0.0",
        "run_id": started.strftime("%Y-%m-%dT%H-%M-%SZ") + "-" + f"{RNG.randrange(16**6):06x}",
        "started_at": iso(started),
        "finished_at": iso(started + timedelta(seconds=secs)),
        "status": status,
        "data_changed": data_changed,
        "cost_usd": cost,
        "model_usage": {
            "fast": {"input_tokens": fast[0], "output_tokens": fast[1]},
            "smart": {"input_tokens": smart[0], "output_tokens": smart[1]},
        },
        "sources": sources,
    }
    if extra:
        m.update(extra)
    return m


def costs_summary(per_run: float, runs_by_day: dict[str, int], all_time: float) -> dict:
    daily = []
    total = 0.0
    runs = 0
    for d, n in sorted(runs_by_day.items()):
        usd = round(per_run * n * (0.85 + 0.3 * RNG.random()), 4)
        daily.append({"date": d, "usd": usd})
        total += usd
        runs += n
    return {"month": "2026-09", "total_usd": round(total, 4), "runs": runs, "daily": daily, "all_time_usd": round(all_time + total, 4)}


# --------------------------------------------------------------------------------------
# Real estate
# --------------------------------------------------------------------------------------

METROS = [
    # slug, name, cbsa, lat, lon, base price, homes sold / month, income, profile
    ("houston-tx", "Houston, TX", "26420", 29.79, -95.39, 335000, 7900, 78200, "soft"),
    ("atlanta-ga", "Atlanta, GA", "12060", 33.69, -84.40, 390000, 7100, 86800, "flat"),
    ("chicago-il", "Chicago, IL", "16984", 41.84, -87.82, 335000, 7600, 88900, "hot"),
    ("phoenix-az", "Phoenix, AZ", "38060", 33.19, -112.07, 455000, 5700, 84700, "soft"),
    ("dallas-tx", "Dallas, TX", "19124", 32.84, -96.77, 405000, 6300, 90100, "soft"),
    ("new-york-ny", "New York, NY", "35614", 40.71, -73.99, 690000, 5200, 96100, "hot"),
    ("washington-dc", "Washington, DC", "47894", 38.83, -77.30, 575000, 5400, 123900, "flat"),
    ("tampa-fl", "Tampa, FL", "45300", 28.02, -82.40, 395000, 4800, 72900, "cold"),
    ("los-angeles-ca", "Los Angeles, CA", "31084", 34.20, -118.26, 925000, 4100, 93500, "flat"),
    ("minneapolis-mn", "Minneapolis, MN", "33460", 45.06, -93.35, 375000, 4200, 98700, "warm"),
    ("riverside-ca", "Riverside, CA", "40140", 34.02, -116.89, 590000, 4300, 86200, "flat"),
    ("denver-co", "Denver, CO", "19740", 39.73, -104.99, 610000, 3900, 105400, "cold"),
    ("charlotte-nc", "Charlotte, NC", "16740", 35.21, -80.84, 405000, 3700, 83800, "flat"),
    ("orlando-fl", "Orlando, FL", "36740", 28.53, -81.38, 420000, 3400, 78500, "cold"),
    ("boston-ma", "Boston, MA", "14454", 42.36, -71.06, 760000, 3000, 118100, "hot"),
    ("st-louis-mo", "St. Louis, MO", "41180", 38.63, -90.35, 265000, 3300, 78300, "warm"),
    ("nashville-tn", "Nashville, TN", "34980", 36.16, -86.78, 470000, 3100, 88200, "soft"),
    ("baltimore-md", "Baltimore, MD", "12580", 39.29, -76.61, 370000, 2900, 95100, "warm"),
    ("seattle-wa", "Seattle, WA", "42644", 47.61, -122.33, 830000, 2800, 122200, "warm"),
    ("san-antonio-tx", "San Antonio, TX", "41700", 29.42, -98.49, 305000, 2900, 72800, "cold"),
    ("indianapolis-in", "Indianapolis, IN", "26900", 39.77, -86.16, 300000, 3100, 79400, "warm"),
    ("kansas-city-mo", "Kansas City, MO", "28140", 39.10, -94.58, 315000, 2800, 82700, "warm"),
    ("warren-mi", "Warren, MI", "47664", 42.52, -83.02, 285000, 2600, 83200, "hot"),
    ("austin-tx", "Austin, TX", "12420", 30.26, -97.75, 450000, 2600, 97100, "cold"),
    ("las-vegas-nv", "Las Vegas, NV", "29820", 36.17, -115.14, 450000, 2500, 73600, "soft"),
    ("portland-or", "Portland, OR", "38900", 45.52, -122.68, 540000, 2400, 94100, "flat"),
    ("fort-worth-tx", "Fort Worth, TX", "23104", 32.76, -97.33, 360000, 2500, 83900, "soft"),
    ("jacksonville-fl", "Jacksonville, FL", "27260", 30.33, -81.66, 365000, 2300, 76200, "cold"),
    ("columbus-oh", "Columbus, OH", "18140", 39.96, -83.00, 320000, 2400, 81800, "warm"),
    ("new-brunswick-nj", "New Brunswick, NJ", "35154", 40.49, -74.45, 560000, 2600, 117300, "hot"),
    ("cincinnati-oh", "Cincinnati, OH", "17140", 39.10, -84.51, 290000, 2300, 80100, "warm"),
    ("virginia-beach-va", "Virginia Beach, VA", "47260", 36.85, -75.98, 360000, 2100, 83000, "flat"),
    ("west-palm-beach-fl", "West Palm Beach, FL", "48424", 26.72, -80.05, 530000, 2000, 80400, "cold"),
    ("miami-fl", "Miami, FL", "33124", 25.76, -80.19, 590000, 1900, 69900, "cold"),
    ("san-diego-ca", "San Diego, CA", "41740", 32.72, -117.16, 910000, 2000, 102300, "flat"),
    ("cleveland-oh", "Cleveland, OH", "17460", 41.50, -81.69, 230000, 2200, 69600, "hot"),
    ("north-port-fl", "North Port, FL", "35840", 27.34, -82.24, 455000, 1900, 79800, "cold"),
    ("nassau-county-ny", "Nassau County, NY", "35004", 40.74, -73.59, 735000, 1700, 139600, "hot"),
    ("pittsburgh-pa", "Pittsburgh, PA", "38300", 40.44, -79.99, 235000, 2000, 72100, "warm"),
    ("sacramento-ca", "Sacramento, CA", "40900", 38.58, -121.49, 585000, 1800, 94200, "flat"),
    ("raleigh-nc", "Raleigh, NC", "39580", 35.78, -78.64, 450000, 1800, 98800, "soft"),
    ("oklahoma-city-ok", "Oklahoma City, OK", "36420", 35.47, -97.52, 265000, 1700, 70200, "warm"),
    ("anaheim-ca", "Anaheim, CA", "11244", 33.84, -117.91, 1120000, 1500, 119100, "flat"),
    ("cape-coral-fl", "Cape Coral, FL", "15980", 26.56, -81.95, 390000, 1600, 71500, "cold"),
    ("myrtle-beach-sc", "Myrtle Beach, SC", "34820", 33.69, -78.89, 340000, 1400, 63900, "soft"),
    ("montgomery-county-pa", "Montgomery County, PA", "33874", 40.21, -75.37, 450000, 1500, 111200, "hot"),
    ("oakland-ca", "Oakland, CA", "36084", 37.80, -122.27, 985000, 1400, 128400, "flat"),
    ("philadelphia-pa", "Philadelphia, PA", "37964", 39.95, -75.17, 305000, 1600, 76500, "warm"),
    ("fort-lauderdale-fl", "Fort Lauderdale, FL", "22744", 26.12, -80.14, 460000, 1700, 72300, "cold"),
    ("detroit-mi", "Detroit, MI", "19804", 42.33, -83.05, 205000, 1500, 55900, "hot"),
]

# (yoy price trend, inventory yoy, dom delta, sale-to-list base, price-drop share, above-list share, 2wk share, mos supply)
PROFILES = {
    "hot": (0.055, -0.04, -2, 1.012, 0.052, 0.44, 0.47, 2.1),
    "warm": (0.035, 0.06, 2, 0.994, 0.068, 0.30, 0.38, 2.8),
    "flat": (0.012, 0.12, 5, 0.984, 0.082, 0.22, 0.30, 3.6),
    "soft": (-0.012, 0.19, 8, 0.974, 0.098, 0.15, 0.24, 4.6),
    "cold": (-0.045, 0.29, 12, 0.963, 0.121, 0.09, 0.17, 6.1),
}

REGISTRY = [
    ("median_sale_price", "Median sale price", "currency", "ratio", "neutral", "redfin", "Not seasonally adjusted"),
    ("homes_sold", "Homes sold", "count", "ratio", "up", "redfin", "Monthly count"),
    ("new_listings", "New listings", "count", "ratio", "neutral", "redfin", None),
    ("inventory", "Active inventory", "count", "ratio", "neutral", "redfin", None),
    ("months_of_supply", "Months of supply", "decimal1", "diff", "neutral", "redfin", "< 3 favors sellers, > 6 favors buyers"),
    ("median_dom", "Median days on market", "days", "diff", "neutral", "redfin", None),
    ("avg_sale_to_list", "Sale-to-list ratio", "percent", "pp", "neutral", "redfin", "Average sale price ÷ list price"),
    ("sold_above_list", "Sold above list", "percent", "pp", "neutral", "redfin", "Share of sales"),
    ("price_drops", "Listings with price drops", "percent", "pp", "neutral", "redfin", "Share of active listings"),
    ("off_market_in_two_weeks", "Off market in 2 weeks", "percent", "pp", "neutral", "redfin", "Speed signal"),
    ("zhvi", "Zillow Home Value Index", "currency", "ratio", "neutral", "zillow", "Smoothed, seasonally adjusted, mid-tier"),
    ("zori", "Zillow Observed Rent Index", "currency", "ratio", "neutral", "zillow", "Monthly rent"),
    ("permits_total", "Building permits (units)", "count", "ratio", "neutral", "census_bps", "YoY uses rolling 12-month sums"),
    ("permits_1unit", "Single-family permits", "count", "ratio", "neutral", "census_bps", "YoY uses rolling 12-month sums"),
    ("permits_5plus", "5+ unit permits", "count", "ratio", "neutral", "census_bps", "Multifamily pipeline"),
]
KIND = {k: ck for k, _, _, ck, _, _, _ in REGISTRY}
DELTA_FORMAT = {"ratio": "percent_signed", "pp": "pp_signed"}
DIFF_DELTA = {"median_dom": "days", "months_of_supply": "decimal1"}

RE_DATES = [month_end(*add_months(2023, 9, i)) for i in range(36)]  # 2023-09 .. 2026-08
SEASON = [-0.02, -0.03, -0.012, 0.0, 0.012, 0.022, 0.03, 0.028, 0.018, 0.006, -0.006, -0.015]  # Jan..Dec


def season(d: date, amp=1.0) -> float:
    return SEASON[d.month - 1] * amp


def rnd(x, nd):
    return None if x is None else round(x, nd)


def build_metro_series(base_price, sold, profile, *, rent_missing=False, permits_scale=1.0):
    yoy, inv_yoy, dom_d, stl, drops, above, wk2, mos = PROFILES[profile]
    n = len(RE_DATES)
    s: dict[str, list] = {k: [] for k, *_ in REGISTRY}
    # Price path: 3 years ending at base_price; the most recent year follows `yoy`.
    price_prev_growth = 0.035 + RNG.uniform(-0.01, 0.015)
    inv_level = sold * 3.4 * (mos / 3.0)
    permits_base = sold * 0.55 * permits_scale
    rent_base = base_price * 0.0042 * (1 + RNG.uniform(-0.1, 0.1))
    for i, d in enumerate(RE_DATES):
        months_from_end = n - 1 - i
        # annual growth applied: last 12 months use yoy, earlier use prev growth
        if months_from_end < 12:
            level = base_price * (1 + yoy) ** (-(months_from_end / 12))
        else:
            level = base_price * (1 + yoy) ** (-1) * (1 + price_prev_growth) ** (-((months_from_end - 12) / 12))
        price = level * (1 + season(d)) * (1 + RNG.uniform(-0.006, 0.006))
        s["median_sale_price"].append(round(price / 100) * 100)
        hs = sold * (1 + season(d, 5)) * (1 + RNG.uniform(-0.04, 0.04)) * (0.97 if months_from_end < 12 else 1.0)
        s["homes_sold"].append(int(round(hs)))
        nl = hs * (1.32 + (0.05 if months_from_end < 12 else 0)) * (1 + RNG.uniform(-0.04, 0.04))
        s["new_listings"].append(int(round(nl)))
        inv_growth = (1 + inv_yoy) ** (-(months_from_end / 12)) if months_from_end < 12 else (1 + inv_yoy) ** -1 * (1.08) ** (-((months_from_end - 12) / 12))
        inv = inv_level * inv_growth * (1 + season(d, 3)) * (1 + RNG.uniform(-0.02, 0.02))
        s["inventory"].append(int(round(inv)))
        s["months_of_supply"].append(round(inv / max(hs, 1), 1))
        dom = 38 + (dom_d * 2.2) - season(d, 400) + (0 if months_from_end < 12 else -dom_d) + RNG.uniform(-2, 2)
        s["median_dom"].append(int(round(max(dom, 8))))
        stl_v = stl + season(d, 0.5) - (0 if months_from_end < 12 else (yoy - 0.02) * 0.08) + RNG.uniform(-0.002, 0.002)
        s["avg_sale_to_list"].append(round(stl_v, 4))
        above_v = above + season(d, 4) - (0 if months_from_end < 12 else (yoy - 0.02) * 0.6) + RNG.uniform(-0.01, 0.01)
        s["sold_above_list"].append(round(max(above_v, 0.02), 4))
        drops_v = drops - season(d, 0.9) - (0 if months_from_end < 12 else (0.02 - yoy) * 0.18) + RNG.uniform(-0.004, 0.004)
        s["price_drops"].append(round(max(drops_v, 0.01), 4))
        wk_v = wk2 + season(d, 4) - (0 if months_from_end < 12 else (yoy - 0.02) * 0.5) + RNG.uniform(-0.01, 0.01)
        s["off_market_in_two_weeks"].append(round(max(wk_v, 0.03), 4))
        zh = level * 1.03 * (1 + RNG.uniform(-0.002, 0.002))
        s["zhvi"].append(int(round(zh)))
        if rent_missing:
            s["zori"].append(None)
        else:
            rent_g = 0.025 if yoy > 0 else 0.004
            rv = rent_base * (1 + rent_g) ** (-(months_from_end / 12)) * (1 + RNG.uniform(-0.004, 0.004))
            s["zori"].append(int(round(rv)))
        pt = permits_base * (1 + season(d, 6)) * (1 + RNG.uniform(-0.18, 0.18)) * ((1 - 0.12 * (profile in ("soft", "cold"))) if months_from_end < 12 else 1)
        p1 = pt * RNG.uniform(0.55, 0.72)
        s["permits_total"].append(int(round(pt)))
        s["permits_1unit"].append(int(round(p1)))
        s["permits_5plus"].append(int(round(pt - p1 - pt * 0.04)))
    # A realistic gap: permits for the most recent month are not published yet in a few metros.
    return s


def change(key, series, lag):
    cur = series[-1]
    prev = series[-1 - lag] if len(series) > lag else None
    if cur is None or prev is None:
        return None
    kind = KIND[key]
    if kind == "ratio":
        return round(cur / prev - 1, 4) if prev else None
    if kind == "pp":
        return round(cur - prev, 4)
    return round(cur - prev, 1 if key == "months_of_supply" else 0)


def trend3(series):
    tail = [x for x in series[-3:] if x is not None]
    if len(tail) < 3 or not tail[0]:
        return None
    rel = tail[-1] / tail[0] - 1
    if abs(rel) < 0.005:
        return "flat"
    return "up" if rel > 0 else "down"


def rolling12_yoy(series):
    a = series[-12:]
    b = series[-24:-12]
    if None in a or None in b or len(b) < 12:
        return None
    return round(sum(a) / sum(b) - 1, 4)


def metric_full(key, series):
    cur = series[-1]
    if key.startswith("permits"):
        out = {"value": cur, "yoy_12m": rolling12_yoy(series), "mom": change(key, series, 1), "delta_format": "percent_signed", "trend_3m": trend3(series)}
    else:
        dfmt = DELTA_FORMAT.get(KIND[key]) or DIFF_DELTA[key]
        out = {"value": cur, "yoy": change(key, series, 12), "mom": change(key, series, 1), "delta_format": dfmt, "trend_3m": trend3(series)}
    window = [x for x in series[-36:] if x is not None]
    out["high_36m"] = cur is not None and cur == max(window)
    out["low_36m"] = cur is not None and cur == min(window)
    return out


def ncdf(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def temp_label(score):
    if score is None:
        return None
    if score >= 80:
        return "Hot"
    if score >= 60:
        return "Warm"
    if score >= 40:
        return "Balanced"
    if score >= 20:
        return "Cool"
    return "Cold"


def market_type(mos):
    if mos is None:
        return None
    return "Seller's market" if mos < 3 else ("Buyer's market" if mos > 6 else "Balanced")


def pct_rank(values, v):
    vals = [x for x in values if x is not None]
    if v is None or not vals:
        return None
    return round(sum(1 for x in vals if x < v) / max(len(vals) - 1, 1), 2)


FLAG_LABELS = {
    "inventory_surge": "Inventory +25% YoY",
    "inventory_drop": "Inventory −20% YoY",
    "price_decline": "Prices down 3%+ YoY",
    "price_surge": "Prices up 8%+ YoY",
    "price_36m_high": "Price at 3-year high",
    "price_36m_low": "Price at 3-year low",
    "price_cuts_high": "Price cuts at 3-year high",
    "slowing": "Days on market +10 YoY",
    "buyers_market": "Crossed into buyer's market",
    "sellers_market": "Crossed into seller's market",
    "rent_outpacing": "Rent outpacing home values",
    "permits_boom": "Permits +30% YoY",
    "permits_bust": "Permits −30% YoY",
    "payment_jump": "Payment up 10%+ YoY",
}


def build_real_estate(started: datetime):
    base = OUT / "real_estate"
    if base.exists():
        shutil.rmtree(base)
    rates_dates = []
    d = date(2023, 9, 21)  # Thursdays
    while d <= date(2026, 9, 24):
        rates_dates.append(d)
        d += timedelta(days=7)
    m30 = []
    for i, dd in enumerate(rates_dates):
        t = i / (len(rates_dates) - 1)
        # Peak ~7.8% in Oct 2023, drift down to ~6.2% by Sep 2026 with bumps.
        v = 7.75 - 1.55 * t + 0.35 * math.sin(t * 9.5) * (1 - t) + RNG.uniform(-0.05, 0.05)
        m30.append(round(v, 2))
    m30[-1] = 6.18
    m30[-2] = 6.25
    m15 = [round(v - 0.78 + RNG.uniform(-0.04, 0.04), 2) for v in m30]
    rate_now = m30[-1]
    rate_year_ago = m30[-53]

    metro_series = {}
    for idx, (slug, name, cbsa, lat, lon, price, sold, income, prof) in enumerate(METROS):
        metro_series[slug] = build_metro_series(price, sold, prof, rent_missing=slug in ("myrtle-beach-sc", "cape-coral-fl"), permits_scale=1.6 if prof in ("soft", "cold") else 1.0)
        if slug in ("nassau-county-ny", "montgomery-county-pa"):
            metro_series[slug]["permits_total"][-1] = None
            metro_series[slug]["permits_1unit"][-1] = None
            metro_series[slug]["permits_5plus"][-1] = None

    # Temperature z-scores across metros
    comp_keys = [("avg_sale_to_list", 1), ("sold_above_list", 1), ("off_market_in_two_weeks", 1), ("median_dom", -1), ("price_drops", -1), ("months_of_supply", -1)]
    stats = {}
    for k, _ in comp_keys:
        vals = [metro_series[s][k][-1] for s in metro_series]
        mu = sum(vals) / len(vals)
        sd = (sum((v - mu) ** 2 for v in vals) / len(vals)) ** 0.5
        stats[k] = (mu, sd)
    temps = {}
    for slug, s in metro_series.items():
        comps = {}
        for k, sign in comp_keys:
            mu, sd = stats[k]
            comps[k] = round(sign * (s[k][-1] - mu) / sd, 2)
        raw = sum(comps.values()) / len(comps)
        score = round(100 * ncdf(raw))
        temps[slug] = {"score": score, "label": temp_label(score), "components": comps}

    all_latest = {slug: {k: metric_full(k, s[k]) for k, *_ in REGISTRY} for slug, s in metro_series.items()}
    for k, *_ in REGISTRY:
        vals = [all_latest[s][k]["value"] for s in all_latest]
        yoys = [all_latest[s][k].get("yoy", all_latest[s][k].get("yoy_12m")) for s in all_latest]
        for s in all_latest:
            m = all_latest[s][k]
            m["pct_rank"] = pct_rank(vals, m["value"])
            m["yoy_pct_rank"] = pct_rank(yoys, m.get("yoy", m.get("yoy_12m")))

    national_dates = [x.isoformat() for x in RE_DATES]
    metro_index = []
    alerts_acc: dict[str, dict] = {}
    detail_files = {}
    for slug, name, cbsa, lat, lon, price, sold, income, prof in METROS:
        s = metro_series[slug]
        L = all_latest[slug]
        price_now = s["median_sale_price"][-1]
        price_ago = s["median_sale_price"][-13]
        p_now = round(payment(price_now * 0.8, rate_now, 30), 2)
        p_ago = round(payment(price_ago * 0.8, rate_year_ago, 30), 2)
        afford = {
            "median_household_income": income,
            "income_year": 2024,
            "payment_now": p_now,
            "payment_year_ago": p_ago,
            "payment_change_pct": round(p_now / p_ago - 1, 4),
            "payment_to_income": round(p_now * 12 / income, 4),
            "assumptions": {"down_payment_pct": 0.2, "term_years": 30, "rate_now": rate_now, "rate_year_ago": rate_year_ago, "price_year_ago": price_ago},
        }
        if slug == "detroit-mi":
            afford["median_household_income"] = None
            afford["income_year"] = None
            afford["payment_to_income"] = None
        flags = []

        def flag(fid, sev, facts, label=None):
            flags.append({"id": fid, "label": label or FLAG_LABELS[fid], "severity": sev, "facts": facts})

        inv_y = L["inventory"]["yoy"]
        pr_y = L["median_sale_price"]["yoy"]
        if inv_y is not None and inv_y >= 0.25:
            flag("inventory_surge", "major" if inv_y >= 0.5 else "notable", {"inventory_yoy": inv_y}, f"Inventory +{round(inv_y * 100)}% YoY")
        if inv_y is not None and inv_y <= -0.20:
            flag("inventory_drop", "notable", {"inventory_yoy": inv_y}, f"Inventory {round(inv_y * 100)}% YoY")
        if pr_y is not None and pr_y <= -0.03:
            flag("price_decline", "major" if pr_y <= -0.08 else "notable", {"median_sale_price_yoy": pr_y}, f"Prices {pr_y * 100:.1f}% YoY".replace("-", "−"))
        if pr_y is not None and pr_y >= 0.08:
            flag("price_surge", "notable", {"median_sale_price_yoy": pr_y}, f"Prices +{pr_y * 100:.1f}% YoY")
        if L["median_sale_price"]["high_36m"]:
            flag("price_36m_high", "info", {"median_sale_price": price_now})
        if L["median_sale_price"]["low_36m"]:
            flag("price_36m_low", "info", {"median_sale_price": price_now})
        if L["median_dom"]["yoy"] is not None and L["median_dom"]["yoy"] >= 10:
            flag("slowing", "info", {"median_dom_yoy": L["median_dom"]["yoy"]}, f"Days on market +{int(L['median_dom']['yoy'])} YoY")
        mos_prev, mos_now = s["months_of_supply"][-2], s["months_of_supply"][-1]
        if mos_prev <= 6 < mos_now:
            flag("buyers_market", "notable", {"months_of_supply": mos_now})
        if mos_prev >= 3 > mos_now:
            flag("sellers_market", "notable", {"months_of_supply": mos_now})
        if L["zori"]["yoy"] is not None and L["zhvi"]["yoy"] is not None and L["zori"]["yoy"] - L["zhvi"]["yoy"] >= 0.03:
            flag("rent_outpacing", "info", {"zori_yoy": L["zori"]["yoy"], "zhvi_yoy": L["zhvi"]["yoy"]})
        py = L["permits_total"]["yoy_12m"]
        if py is not None and py <= -0.3:
            flag("permits_bust", "info", {"permits_yoy_12m": py})
        if py is not None and py >= 0.3:
            flag("permits_boom", "info", {"permits_yoy_12m": py})
        if afford["payment_change_pct"] >= 0.10:
            flag("payment_jump", "notable", {"payment_change_pct": afford["payment_change_pct"]})
        if L["price_drops"]["high_36m"] and L["price_drops"]["yoy"] >= 0.03:
            flag("price_cuts_high", "notable", {"price_drops": L["price_drops"]["value"], "price_drops_yoy": L["price_drops"]["yoy"]})
        for f in flags:
            if f["severity"] in ("notable", "major"):
                a = alerts_acc.setdefault(f["id"], {"flag": f["id"], "label": FLAG_LABELS[f["id"]], "severity": f["severity"], "slugs": [], "_sizes": []})
                if f["severity"] == "major":
                    a["severity"] = "major"
                a["slugs"].append(slug)
                a["_sizes"].append(sum(s["homes_sold"][-12:]))

        t = temps[slug]
        mt = market_type(s["months_of_supply"][-1])
        dir_word = "down" if pr_y < 0 else "up"
        excerpt = (
            f"{name.split(',')[0]}'s median sale price is {dir_word} {abs(pr_y) * 100:.1f}% from a year ago at ${price_now:,.0f}, "
            f"with inventory {'up' if inv_y >= 0 else 'down'} {abs(inv_y) * 100:.0f}%."
        )
        if len(excerpt) > 160:
            excerpt = excerpt[:157] + "…"
        brief_text = (
            excerpt
            + f" Homes are taking a median {L['median_dom']['value']} days to sell and {L['price_drops']['value'] * 100:.1f}% of listings had a price cut. "
            + f"Relative to the other 49 tracked metros the market reads {t['label'].lower()} (score {t['score']}), and at {s['months_of_supply'][-1]} months of supply it is {mt.lower()}. "
            + f"The monthly payment on a median home with 20% down is ${p_now:,.0f}, {'up' if afford['payment_change_pct'] >= 0 else 'down'} {abs(afford['payment_change_pct']) * 100:.1f}% from a year ago."
        )
        key_points = [
            f"Price {pr_y * 100:+.1f}% YoY".replace("-", "−"),
            f"Inventory {inv_y * 100:+.0f}% YoY".replace("-", "−"),
            f"{L['median_dom']['value']} median days on market",
        ]
        narrative_source = "template" if slug in ("oklahoma-city-ok", "myrtle-beach-sc") else "llm"
        brief = {
            "text": brief_text,
            "key_points": key_points,
            "citations": [
                {"name": "Redfin Data Center", "url": "https://www.redfin.com/news/data-center/"},
                {"name": "Freddie Mac PMMS via FRED", "url": "https://fred.stlouisfed.org/series/MORTGAGE30US"},
            ],
            "narrative_source": narrative_source,
            "model": None if narrative_source == "template" else "claude-haiku-4-5-20251001",
            "generated_at": iso(started + timedelta(seconds=55)),
            "reused": slug in ("st-louis-mo",),
        }
        detail = {
            "slug": slug,
            "name": name,
            "cbsa": cbsa,
            "lat": lat,
            "lon": lon,
            "data_through": national_dates[-1],
            "latest": L,
            "temperature": t,
            "market_type": mt,
            "flags": flags,
            "affordability": afford,
            "series": {"dates": national_dates, **s},
            "brief": brief,
        }
        detail_files[slug] = detail
        index_latest = {}
        for k, *_ in REGISTRY:
            v = L[k]
            if k.startswith("permits"):
                if k == "permits_total":
                    index_latest[k] = {"value": v["value"], "yoy_12m": v["yoy_12m"]}
            else:
                index_latest[k] = {"value": v["value"], "yoy": v["yoy"]}
        metro_index.append({
            "slug": slug,
            "name": name,
            "cbsa": cbsa,
            "lat": lat,
            "lon": lon,
            "homes_sold_12m": sum(s["homes_sold"][-12:]),
            "latest": index_latest,
            "temperature": {"score": t["score"], "label": t["label"]},
            "market_type": mt,
            "flags": [f["id"] for f in flags],
            "brief_excerpt": excerpt,
        })

    # national series = aggregate of metros scaled
    nat = {}
    for k in ["median_sale_price", "inventory", "median_dom", "price_drops", "avg_sale_to_list", "months_of_supply", "homes_sold", "new_listings"]:
        col = []
        for i in range(36):
            vals = [metro_series[s][k][i] for s in metro_series]
            if k in ("inventory", "homes_sold", "new_listings"):
                col.append(int(round(sum(vals) * 6.9)))
            elif k == "median_sale_price":
                col.append(round(sorted(vals)[len(vals) // 2] * 0.98 / 100) * 100)
            elif k == "median_dom":
                col.append(int(round(sorted(vals)[len(vals) // 2])))
            elif k == "months_of_supply":
                col.append(None)
            else:
                col.append(round(sum(vals) / len(vals), 4))
        nat[k] = col
    nat["months_of_supply"] = [round(nat["inventory"][i] / nat["homes_sold"][i], 1) for i in range(36)]
    nat_latest = {}
    for k in nat:
        full = metric_full(k, nat[k])
        nat_latest[k] = {kk: full[kk] for kk in ("value", "yoy", "mom", "delta_format", "trend_3m")}
    # national temperature vs own history
    zs = []
    for k, sign in comp_keys:
        if k not in nat:
            continue
        hist = nat[k]
        mu = sum(hist) / len(hist)
        sd = (sum((v - mu) ** 2 for v in hist) / len(hist)) ** 0.5 or 1
        zs.append(sign * (hist[-1] - mu) / sd)
    nat_score = round(100 * ncdf(sum(zs) / len(zs)))

    starts_dates = [month_end(*add_months(2023, 9, i)).replace(day=1) for i in range(36)]
    starts = [int(round(1380 + 60 * math.sin(i / 4) - i * 1.2 + RNG.uniform(-40, 40))) for i in range(36)]
    permits_nat = [int(round(1450 + 40 * math.sin(i / 5) - i * 1.4 + RNG.uniform(-30, 30))) for i in range(36)]
    starts[-1], starts[-2] = 1342, 1371
    permits_nat[-1], permits_nat[-2] = 1398, 1381

    n_cuts = sum(1 for m in metro_index if m["latest"]["price_drops"]["yoy"] is not None and m["latest"]["price_drops"]["yoy"] > 0)
    inv_yoy_nat = nat_latest["inventory"]["yoy"]
    price_yoy_nat = nat_latest["median_sale_price"]["yoy"]
    headline = f"Inventory up {round(inv_yoy_nat * 100)}% YoY nationally; {n_cuts} of 50 metros have more price cuts than a year ago."
    key_stats = [
        {"label": "US median sale price", "value": nat_latest["median_sale_price"]["value"], "format": "currency_compact", "delta": price_yoy_nat, "delta_format": "percent_signed", "good_direction": "neutral"},
        {"label": "30-yr mortgage", "value": rate_now, "format": "percent", "delta": round(rate_now - m30[-2], 2), "delta_format": "pp_signed", "good_direction": "neutral"},
    ]

    def movers(key, reverse, sign_filter):
        cands = [m for m in metro_index if m["latest"][key]["yoy"] is not None and sign_filter(m["latest"][key]["yoy"])]
        cands.sort(key=lambda m: (-m["latest"][key]["yoy"] if reverse else m["latest"][key]["yoy"], -m["homes_sold_12m"]))
        return [{"slug": m["slug"], "name": m["name"], "value": m["latest"][key]["yoy"]} for m in cands[:5]]

    alerts = []
    for a in sorted(alerts_acc.values(), key=lambda a: (-{"major": 2, "notable": 1}[a["severity"]], -len(a["slugs"]))):
        order = sorted(zip(a["slugs"], a["_sizes"]), key=lambda x: -x[1])
        alerts.append({"flag": a["flag"], "label": a["label"], "severity": a["severity"], "slugs": [s for s, _ in order]})

    re_sources_meta = [
        {"name": "Redfin Data Center", "url": "https://www.redfin.com/news/data-center/", "retrieved_at": iso(started + timedelta(seconds=4))},
        {"name": "Zillow Research", "url": "https://www.zillow.com/research/data/", "retrieved_at": iso(started + timedelta(seconds=9))},
        {"name": "FRED", "url": "https://fred.stlouisfed.org/", "retrieved_at": iso(started + timedelta(seconds=11))},
        {"name": "U.S. Census Bureau", "url": "https://www.census.gov/construction/bps/", "retrieved_at": iso(started + timedelta(seconds=13))},
    ]
    latest = {
        "meta": meta("real_estate", started, 158, 0.071, re_sources_meta, fast=(61200, 9800), smart=(5400, 610)),
        "headline": headline,
        "key_stats": key_stats,
        "data_through": national_dates[-1],
        "rates_as_of": rates_dates[-1].isoformat(),
        "metric_registry": [
            {"key": k, "label": lbl, "format": fmt, "change_kind": ck, "good_direction": gd, "source": src, "note": note}
            for k, lbl, fmt, ck, gd, src, note in REGISTRY
        ],
        "national": {
            "latest": nat_latest,
            "temperature": {"score": nat_score, "label": temp_label(nat_score), "basis": "vs own 3-year history"},
            "series": {"dates": national_dates, **nat},
            "rates": {
                "dates": [x.isoformat() for x in rates_dates],
                "mortgage30": m30,
                "mortgage15": m15,
                "latest": {"mortgage30": rate_now, "mortgage30_change_1w_pp": round(rate_now - m30[-2], 2), "mortgage30_year_ago": rate_year_ago},
            },
            "construction": {
                "housing_starts": {"value": starts[-1], "mom": round(starts[-1] / starts[-2] - 1, 4), "units": "thousands, SAAR", "period": starts_dates[-1].isoformat()},
                "permits": {"value": permits_nat[-1], "mom": round(permits_nat[-1] / permits_nat[-2] - 1, 4), "units": "thousands, SAAR", "period": starts_dates[-1].isoformat()},
                "series": {"dates": [x.isoformat() for x in starts_dates], "housing_starts": starts, "permits": permits_nat},
            },
            "case_shiller": {"value": 331.2, "yoy": 0.018, "period": "2026-06-01"},
            "brief": {
                "text": (
                    f"Active inventory is up {inv_yoy_nat * 100:.0f}% from a year ago, the fastest build in listings since the data series began to normalize after 2022. "
                    f"The national median sale price is {'up' if price_yoy_nat >= 0 else 'down'} {abs(price_yoy_nat) * 100:.1f}% YoY at ${nat_latest['median_sale_price']['value']:,.0f}, so prices are roughly flat in real terms. "
                    f"{n_cuts} of the 50 tracked metros now have a larger share of listings with price cuts than a year ago, concentrated in Florida and Texas. "
                    f"The 30-year mortgage rate eased to {rate_now:.2f}% from {rate_year_ago:.2f}% a year ago, which trims the typical payment. "
                    "Midwest and Northeast metros remain the most competitive, with homes still selling near or above list price."
                ),
                "key_points": [
                    f"Inventory {inv_yoy_nat * 100:+.0f}% YoY nationally",
                    f"{n_cuts} of 50 metros have more price cuts than last year",
                    f"30-yr rate {rate_now:.2f}%, down {rate_year_ago - rate_now:.2f} pp YoY",
                ],
                "citations": [
                    {"name": "Redfin Data Center", "url": "https://www.redfin.com/news/data-center/"},
                    {"name": "FRED: MORTGAGE30US", "url": "https://fred.stlouisfed.org/series/MORTGAGE30US"},
                ],
                "narrative_source": "llm",
                "model": "claude-sonnet-5",
                "generated_at": iso(started + timedelta(seconds=140)),
            },
        },
        "metros": metro_index,
        "movers": {
            "price_gains": movers("median_sale_price", True, lambda v: v > 0),
            "price_declines": movers("median_sale_price", False, lambda v: v < 0),
            "inventory_growth": movers("inventory", True, lambda v: v > 0),
        },
        "alerts": alerts,
        "sources": [
            {"name": "Redfin Data Center", "url": "https://www.redfin.com/news/data-center/", "attribution": "Data: Redfin, a national real estate brokerage."},
            {"name": "Zillow Research", "url": "https://www.zillow.com/research/data/", "attribution": "Zillow Home Value Index (ZHVI) and Zillow Observed Rent Index (ZORI)"},
            {"name": "FRED, Federal Reserve Bank of St. Louis", "url": "https://fred.stlouisfed.org/"},
            {"name": "U.S. Census Bureau, Building Permits Survey", "url": "https://www.census.gov/construction/bps/"},
        ],
    }
    for slug, detail in detail_files.items():
        write(base / "metros" / f"{slug}.json", detail)
    write(base / "latest.json", latest)
    write(base / "history" / f"{started.date().isoformat()}.json", latest)
    manifest = {
        "id": "real_estate",
        "name": "Real Estate Market Agent",
        "route": "/real-estate",
        "status": "ok",
        "last_run_at": latest["meta"]["finished_at"],
        "last_data_change_at": latest["meta"]["finished_at"],
        "expected_interval_hours": 168,
        "next_run_hint": "Fridays 08:00 PT",
        "headline": headline,
        "key_stats": key_stats,
        "run_cost_usd": latest["meta"]["cost_usd"],
        "items_count": 50,
    }
    write(base / "manifest-entry.json", manifest)
    write(base / "costs-summary.json", costs_summary(0.07, {"2026-09-04": 1, "2026-09-11": 1, "2026-09-18": 1, "2026-09-25": 1}, 1.19))


# --------------------------------------------------------------------------------------
# Macro
# --------------------------------------------------------------------------------------

MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def mlabel(d: date) -> str:
    return f"{MONTH_ABBR[d.month - 1]} {d.year}"


def monthly_dates(end_y, end_m, n):
    return [date(*add_months(end_y, end_m, -(n - 1 - i)), 1) for i in range(n)]


def path(n, start, end, noise, wiggle=0.0, period=18.0):
    out = []
    for i in range(n):
        t = i / (n - 1)
        v = start + (end - start) * t + wiggle * math.sin(i / period * 2 * math.pi) + RNG.uniform(-noise, noise)
        out.append(v)
    out[-1] = end
    return out


def inflation_path(n):
    # 10y of YoY inflation: ~1.8 → dip 2020 → spike 2022 (~8-9) → decline to ~3
    out = []
    for i in range(n):
        yr = 2016 + 8 / 12 + i / 12
        if yr < 2020.2:
            v = 1.9 + 0.3 * math.sin(i / 5)
        elif yr < 2021.0:
            v = 0.6 + (yr - 2020.2) * 1.2
        elif yr < 2022.5:
            v = 1.4 + (yr - 2021.0) * 5.0
        elif yr < 2023.6:
            v = 8.9 - (yr - 2022.5) * 4.8
        else:
            v = 3.6 - (yr - 2023.6) * 0.45 + 0.25 * math.sin(i / 3)
        out.append(v + RNG.uniform(-0.08, 0.08))
    return out


def build_macro(started: datetime):
    base = OUT / "macro"
    if base.exists():
        shutil.rmtree(base)
    n10 = 120
    mdates = monthly_dates(2026, 8, n10)  # Sep 2016 .. Aug 2026
    fred = lambda s: f"https://fred.stlouisfed.org/series/{s}"
    indicators = []

    def ind(id_, name, group, series, freq, units, primary, change, secondary, period, released, nxt, dates, values, revision=None, delayed=False, spark_n=24):
        vals = [None if v is None else round(v, 2) for v in values]
        indicators.append({
            "id": id_,
            "name": name,
            "group": group,
            "fred_series": series,
            "source_url": fred(series),
            "frequency": freq,
            "units_display": units,
            "primary": primary,
            "change": change,
            "secondary": secondary,
            "period": period.isoformat(),
            "period_label": mlabel(period) if freq != "quarterly" else f"Q{(period.month - 1) // 3 + 1} {period.year}",
            "released_at": released,
            "next_release": nxt,
            "delayed": delayed,
            "revision": revision,
            "spark": {"dates": [d.isoformat() for d in dates[-spark_n:]], "values": vals[-spark_n:]},
            "series": {"dates": [d.isoformat() for d in dates], "values": vals},
        })

    ds = [d for d in mdates]
    cpi = inflation_path(n10)
    cpi[-1], cpi[-2], cpi[-3] = 2.9, 2.7, 2.7
    ind("cpi", "CPI (all items)", "inflation", "CPIAUCSL", "monthly", "percent",
        {"label": "YoY", "value": 2.9, "format": "percent"},
        {"label": "vs prior", "value": 0.2, "format": "pp_signed", "good_direction": "down"},
        [{"label": "MoM", "value": 0.3, "format": "percent_signed"}],
        ds[-1], "2026-09-11", "2026-10-14", ds, cpi)
    core = [v + 0.35 - 0.0 * i for i, v in enumerate(inflation_path(n10))]
    core[-1], core[-2] = 3.1, 3.1
    ind("core_cpi", "Core CPI", "inflation", "CPILFESL", "monthly", "percent",
        {"label": "YoY", "value": 3.1, "format": "percent"},
        {"label": "vs prior", "value": 0.0, "format": "pp_signed", "good_direction": "down"},
        [{"label": "MoM", "value": 0.3, "format": "percent_signed"}, {"label": "3-mo ann.", "value": 3.4, "format": "percent"}],
        ds[-1], "2026-09-11", "2026-10-14", ds, core)
    pce_dates = monthly_dates(2026, 7, n10)
    pce = [v * 0.86 for v in inflation_path(n10)]
    pce[-1], pce[-2] = 2.6, 2.5
    ind("pce", "PCE price index", "inflation", "PCEPI", "monthly", "percent",
        {"label": "YoY", "value": 2.6, "format": "percent"},
        {"label": "vs prior", "value": 0.1, "format": "pp_signed", "good_direction": "down"},
        [], pce_dates[-1], "2026-08-29", "2026-09-26", pce_dates, pce)
    cpce = [v * 0.84 + 0.35 for v in inflation_path(n10)]
    cpce[-1], cpce[-2] = 2.8, 2.9
    ind("core_pce", "Core PCE", "inflation", "PCEPILFE", "monthly", "percent",
        {"label": "YoY", "value": 2.8, "format": "percent"},
        {"label": "vs prior", "value": -0.1, "format": "pp_signed", "good_direction": "down"},
        [{"label": "3-mo ann.", "value": 2.4, "format": "percent"}], pce_dates[-1], "2026-08-29", "2026-09-26", pce_dates, cpce)
    be = path(n10, 1.8, 2.34, 0.08, wiggle=0.3, period=40)
    ind("breakeven5y", "5-yr breakeven inflation", "inflation", "T5YIE", "daily", "percent",
        {"label": "Level", "value": 2.34, "format": "percent"},
        {"label": "vs prior week", "value": -0.03, "format": "pp_signed", "good_direction": "neutral"},
        [], date(2026, 9, 25), "2026-09-25", "2026-09-28", ds, be)
    # Labor
    un = []
    for i in range(n10):
        yr = 2016 + 8 / 12 + i / 12
        if yr < 2020.2:
            v = 4.9 - (yr - 2016.7) * 0.38
        elif yr < 2020.4:
            v = 14.7
        elif yr < 2022.2:
            v = 14.7 - (yr - 2020.4) * 6.0
            v = max(v, 3.8)
        elif yr < 2023.5:
            v = 3.6
        else:
            v = 3.6 + (yr - 2023.5) * 0.27
        un.append(v + RNG.uniform(-0.05, 0.05))
    un[-1], un[-2], un[-3] = 4.4, 4.3, 4.2
    ind("unrate", "Unemployment rate", "labor", "UNRATE", "monthly", "percent",
        {"label": "Level", "value": 4.4, "format": "percent"},
        {"label": "vs prior", "value": 0.1, "format": "pp_signed", "good_direction": "down"},
        [], ds[-1], "2026-09-05", "2026-10-02", ds, un)
    pay = [RNG.uniform(120, 260) for _ in range(n10)]
    for i in range(n10):
        yr = 2016 + 8 / 12 + i / 12
        if 2020.25 <= yr < 2020.34:
            pay[i] = -20500
        elif 2020.34 <= yr < 2020.6:
            pay[i] = 3800
        elif 2021.0 <= yr < 2022.5:
            pay[i] = RNG.uniform(350, 700)
        elif yr >= 2025.2:
            pay[i] = RNG.uniform(20, 140)
    pay[-1], pay[-2], pay[-3] = 22, 41, 120
    ind("payrolls", "Nonfarm payrolls", "labor", "PAYEMS", "monthly", "thousands",
        {"label": "MoM change", "value": 22, "format": "count_signed_thousands"},
        {"label": "vs prior", "value": -19, "format": "count_signed_thousands", "good_direction": "up"},
        [{"label": "3-mo avg", "value": 61, "format": "count_signed_thousands"}],
        ds[-1], "2026-09-05", "2026-10-02", ds, pay,
        revision={"period_label": "Jul 2026", "old": 73, "new": 41, "format": "count_signed_thousands"})
    wk = []
    d0 = date(2026, 9, 19)
    wdates = [d0 - timedelta(weeks=(103 - i)) for i in range(104)]
    claims = path(104, 218000, 231000, 9000, wiggle=6000, period=26)
    ind("claims", "Initial jobless claims", "labor", "ICSA", "weekly", "count",
        {"label": "Level", "value": 231000, "format": "count"},
        {"label": "vs prior week", "value": 7000, "format": "count_signed", "good_direction": "down"},
        [{"label": "4-wk avg", "value": 226250, "format": "count"}],
        d0, "2026-09-25", "2026-10-01", wdates, claims, spark_n=52)
    jolts_dates = monthly_dates(2026, 7, n10)
    jolts = [5.8 + 5.5 * math.exp(-((i - 67) / 14) ** 2) + RNG.uniform(-0.2, 0.2) for i in range(n10)]
    jolts = [v if i > 40 else 6.6 + RNG.uniform(-0.3, 0.3) for i, v in enumerate(jolts)]
    jolts[-1], jolts[-2] = 7.18, 7.36
    ind("jolts", "Job openings (JOLTS)", "labor", "JTSJOL", "monthly", "millions",
        {"label": "Level", "value": 7.18, "format": "decimal1"},
        {"label": "vs prior", "value": -0.18, "format": "decimal1", "good_direction": "neutral"},
        [], jolts_dates[-1], "2026-09-02", "2026-09-30", jolts_dates, jolts, revision={"period_label": "Jun 2026", "old": 7.44, "new": 7.36, "format": "decimal1"})
    ahe = path(n10, 2.6, 3.8, 0.12, wiggle=0.9, period=60)
    ahe[-1], ahe[-2] = 3.8, 3.9
    ind("ahe", "Average hourly earnings", "labor", "CES0500000003", "monthly", "percent",
        {"label": "YoY", "value": 3.8, "format": "percent"},
        {"label": "vs prior", "value": -0.1, "format": "pp_signed", "good_direction": "neutral"},
        [], ds[-1], "2026-09-05", "2026-10-02", ds, ahe)
    # Growth
    qd = [date(*add_months(2016, 7, 3 * i), 1) for i in range(40)]  # Q3 2016 .. Q2 2026
    gdp = [RNG.uniform(1.2, 3.4) for _ in range(40)]
    for i, d in enumerate(qd):
        if d.year == 2020 and d.month == 4:
            gdp[i] = -28.0
        if d.year == 2020 and d.month == 7:
            gdp[i] = 35.2
        if d.year == 2020 and d.month == 1:
            gdp[i] = -5.5
    gdp[-1], gdp[-2] = 2.1, 0.8
    ind("gdp", "Real GDP growth", "growth", "A191RL1Q225SBEA", "quarterly", "percent",
        {"label": "Annualized", "value": 2.1, "format": "percent"},
        {"label": "vs prior", "value": 1.3, "format": "pp_signed", "good_direction": "up"},
        [], qd[-1], "2026-08-28", "2026-09-25", qd, gdp, spark_n=12, delayed=True)
    rs = path(n10, 3.5, 2.6, 1.2, wiggle=1.0, period=30)
    ind("retail", "Retail sales", "growth", "RSAFS", "monthly", "percent",
        {"label": "YoY", "value": 2.6, "format": "percent"},
        {"label": "MoM", "value": 0.2, "format": "percent_signed", "good_direction": "up"},
        [], ds[-1], "2026-09-16", "2026-10-16", ds, rs)
    ip = path(n10, 1.0, 0.7, 0.8, wiggle=1.4, period=36)
    ind("indpro", "Industrial production", "growth", "INDPRO", "monthly", "percent",
        {"label": "YoY", "value": 0.7, "format": "percent"},
        {"label": "MoM", "value": -0.1, "format": "percent_signed", "good_direction": "up"},
        [], ds[-1], "2026-09-17", "2026-10-17", ds, ip)
    # Rates (daily → weekly resampled). Build 10y of Friday closes.
    fridays = [date(2026, 9, 25) - timedelta(weeks=(519 - i)) for i in range(520)]

    def rate_path(points):
        # piecewise-linear over (fraction, value) points
        out = []
        for i in range(520):
            t = i / 519
            for (t0, v0), (t1, v1) in zip(points, points[1:]):
                if t0 <= t <= t1:
                    v = v0 + (v1 - v0) * (t - t0) / (t1 - t0)
                    break
            out.append(round(v + RNG.uniform(-0.04, 0.04), 2))
        return out

    ff_upper = []
    for d in fridays:
        y = d.year + (d.timetuple().tm_yday / 365)
        if y < 2017.2: v = 0.75
        elif y < 2018.0: v = 1.25
        elif y < 2019.0: v = 2.25
        elif y < 2019.6: v = 2.5
        elif y < 2020.2: v = 1.75
        elif y < 2022.2: v = 0.25
        elif y < 2022.5: v = 1.75
        elif y < 2023.0: v = 4.5
        elif y < 2023.6: v = 5.25
        elif y < 2024.7: v = 5.5
        elif y < 2024.9: v = 5.0
        elif y < 2025.7: v = 4.5
        elif y < 2025.95: v = 4.25
        else: v = 4.25
        ff_upper.append(v)
    ff_upper[-1] = 4.25
    y2 = rate_path([(0, 0.78), (0.3, 1.6), (0.35, 0.2), (0.53, 0.25), (0.62, 3.1), (0.7, 5.0), (0.8, 4.7), (0.85, 3.9), (0.9, 4.2), (1.0, 3.58)])
    y10 = rate_path([(0, 1.62), (0.2, 2.9), (0.33, 1.6), (0.36, 0.65), (0.5, 1.5), (0.6, 2.9), (0.7, 4.3), (0.78, 3.9), (0.85, 4.4), (0.92, 4.5), (1.0, 4.12)])
    y2[-1], y10[-1] = 3.58, 4.12
    y3m = [round(max(u - 0.2 + RNG.uniform(-0.05, 0.05), 0.01), 2) for u in ff_upper]
    y3m[-1] = 4.02
    y5 = [round((a + b) / 2 + 0.05, 2) for a, b in zip(y2, y10)]
    y5[-1] = 3.71
    y30 = [round(b + 0.45 + RNG.uniform(-0.05, 0.05), 2) for b in y10]
    y30[-1] = 4.71
    spread = [round(b - a, 2) for a, b in zip(y2, y10)]
    spread[-1] = 0.54
    spread_3m = [round(b - a, 2) for a, b in zip(y3m, y10)]
    inv = []
    start = None
    for d, s in zip(fridays, spread):
        if s < 0 and start is None:
            start = d
        if s >= 0 and start is not None:
            inv.append({"start": start.isoformat(), "end": d.isoformat()})
            start = None
    if start is not None:
        inv.append({"start": start.isoformat(), "end": None})
    inv = [p for p in inv if p["end"] is None or (date.fromisoformat(p["end"]) - date.fromisoformat(p["start"])).days > 20]
    wd = fridays
    ind("fed_funds_upper", "Fed funds target (upper)", "rates", "DFEDTARU", "daily", "percent",
        {"label": "Level", "value": 4.25, "format": "percent"},
        {"label": "vs prior", "value": 0.0, "format": "pp_signed", "good_direction": "neutral"},
        [{"label": "Lower bound", "value": 4.0, "format": "percent"}], date(2026, 9, 25), "2026-09-25", "2026-09-28", wd, ff_upper, spark_n=104)
    effr = [round(u - 0.17, 2) for u in ff_upper]
    ind("effr", "Effective fed funds rate", "rates", "EFFR", "daily", "percent",
        {"label": "Level", "value": 4.08, "format": "percent"},
        {"label": "vs prior week", "value": 0.0, "format": "pp_signed", "good_direction": "neutral"},
        [], date(2026, 9, 24), "2026-09-25", "2026-09-28", wd, effr, spark_n=104)
    for id_, nm, sid, arr, ch in [("t3m", "3-month Treasury", "DGS3MO", y3m, -0.02), ("t2y", "2-year Treasury", "DGS2", y2, -0.04), ("t5y", "5-year Treasury", "DGS5", y5, -0.05), ("t10y", "10-year Treasury", "DGS10", y10, -0.06), ("t30y", "30-year Treasury", "DGS30", y30, -0.03)]:
        ind(id_, nm, "rates", sid, "daily", "percent",
            {"label": "Level", "value": arr[-1], "format": "percent"},
            {"label": "vs prior week", "value": ch, "format": "pp_signed", "good_direction": "neutral"},
            [], date(2026, 9, 25), "2026-09-25", "2026-09-28", wd, arr, spark_n=104)
    ind("spread_10y2y", "10Y–2Y spread", "rates", "T10Y2Y", "daily", "pp",
        {"label": "Level", "value": 0.54, "format": "pp_signed"},
        {"label": "vs prior week", "value": -0.02, "format": "pp_signed", "good_direction": "neutral"},
        [], date(2026, 9, 25), "2026-09-25", "2026-09-28", wd, spread, spark_n=104)
    spread_3m[-1] = 0.10
    ind("spread_10y3m", "10Y–3M spread", "rates", "T10Y3M", "daily", "pp",
        {"label": "Level", "value": 0.10, "format": "pp_signed"},
        {"label": "vs prior week", "value": -0.04, "format": "pp_signed", "good_direction": "neutral"},
        [], date(2026, 9, 25), "2026-09-25", "2026-09-28", wd, spread_3m, spark_n=104)
    mort_w = [date(2026, 9, 24) - timedelta(weeks=(519 - i)) for i in range(520)]
    mort = rate_path([(0, 3.45), (0.2, 4.6), (0.35, 3.3), (0.5, 2.8), (0.6, 5.5), (0.7, 7.6), (0.75, 6.6), (0.82, 7.2), (0.9, 6.4), (1.0, 6.18)])
    mort[-1] = 6.18
    ind("mortgage30", "30-yr mortgage rate", "rates", "MORTGAGE30US", "weekly", "percent",
        {"label": "Level", "value": 6.18, "format": "percent"},
        {"label": "vs prior week", "value": -0.07, "format": "pp_signed", "good_direction": "neutral"},
        [], date(2026, 9, 24), "2026-09-24", "2026-10-01", mort_w, mort, spark_n=104)
    um_dates = monthly_dates(2026, 8, n10)
    um = path(n10, 91, 58.2, 2.5, wiggle=9, period=44)
    ind("umich", "UMich consumer sentiment", "sentiment", "UMCSENT", "monthly", "index",
        {"label": "Level", "value": 58.2, "format": "decimal1"},
        {"label": "vs prior", "value": -1.7, "format": "decimal1", "good_direction": "up"},
        [], um_dates[-1], "2026-09-12", "2026-10-10", um_dates, um)

    snapshot = [{"tenor": "3M", "value": 4.02}, {"tenor": "2Y", "value": 3.58}, {"tenor": "5Y", "value": 3.71}, {"tenor": "10Y", "value": 4.12}, {"tenor": "30Y", "value": 4.71}]

    prev_text = (
        "Recent indicators suggest that economic activity has continued to expand at a solid pace. "
        "Job gains have remained solid, and the unemployment rate has remained low. "
        "Inflation remains somewhat elevated.\n\n"
        "The Committee seeks to achieve maximum employment and inflation at the rate of 2 percent over the longer run. "
        "Uncertainty about the economic outlook remains elevated. "
        "The Committee is attentive to the risks to both sides of its dual mandate.\n\n"
        "In support of its goals, the Committee decided to maintain the target range for the federal funds rate at 4-1/4 to 4-1/2 percent. "
        "In considering the extent and timing of additional adjustments to the target range for the federal funds rate, the Committee will carefully assess incoming data, the evolving outlook, and the balance of risks. "
        "The Committee will continue reducing its holdings of Treasury securities and agency debt and agency mortgage-backed securities. "
        "The Committee is strongly committed to supporting maximum employment and returning inflation to its 2 percent objective.\n\n"
        "In assessing the appropriate stance of monetary policy, the Committee will continue to monitor the implications of incoming information for the economic outlook. "
        "The Committee would be prepared to adjust the stance of monetary policy as appropriate if risks emerge that could impede the attainment of the Committee's goals. "
        "The Committee's assessments will take into account a wide range of information, including readings on labor market conditions, inflation pressures and inflation expectations, and financial and international developments."
    )
    latest_text = (
        "Recent indicators suggest that growth of economic activity moderated in the first half of the year. "
        "Job gains have slowed, and the unemployment rate has edged up but remains low. "
        "Inflation has moved up and remains somewhat elevated.\n\n"
        "The Committee seeks to achieve maximum employment and inflation at the rate of 2 percent over the longer run. "
        "Uncertainty about the economic outlook remains elevated. "
        "The Committee is attentive to the risks to both sides of its dual mandate and judges that downside risks to employment have risen.\n\n"
        "In support of its goals and in light of the shift in the balance of risks, the Committee decided to lower the target range for the federal funds rate by 1/4 percentage point to 4 to 4-1/4 percent. "
        "In considering the extent and timing of additional adjustments to the target range for the federal funds rate, the Committee will carefully assess incoming data, the evolving outlook, and the balance of risks. "
        "The Committee will continue reducing its holdings of Treasury securities and agency debt and agency mortgage-backed securities. "
        "The Committee is strongly committed to supporting maximum employment and returning inflation to its 2 percent objective.\n\n"
        "In assessing the appropriate stance of monetary policy, the Committee will continue to monitor the implications of incoming information for the economic outlook. "
        "The Committee would be prepared to adjust the stance of monetary policy as appropriate if risks emerge that could impede the attainment of the Committee's goals. "
        "The Committee's assessments will take into account a wide range of information, including readings on labor market conditions, inflation pressures and inflation expectations, and financial and international developments."
    )
    changes = [
        {"idx": 0, "type": "modified", "before": "Recent indicators suggest that economic activity has continued to expand at a solid pace.", "after": "Recent indicators suggest that growth of economic activity moderated in the first half of the year."},
        {"idx": 1, "type": "modified", "before": "Job gains have remained solid, and the unemployment rate has remained low.", "after": "Job gains have slowed, and the unemployment rate has edged up but remains low."},
        {"idx": 2, "type": "modified", "before": "Inflation remains somewhat elevated.", "after": "Inflation has moved up and remains somewhat elevated."},
        {"idx": 5, "type": "modified", "before": "The Committee is attentive to the risks to both sides of its dual mandate.", "after": "The Committee is attentive to the risks to both sides of its dual mandate and judges that downside risks to employment have risen."},
        {"idx": 6, "type": "modified", "before": "In support of its goals, the Committee decided to maintain the target range for the federal funds rate at 4-1/4 to 4-1/2 percent.", "after": "In support of its goals and in light of the shift in the balance of risks, the Committee decided to lower the target range for the federal funds rate by 1/4 percentage point to 4 to 4-1/4 percent."},
    ]
    events = [
        {"id": "fomc_decision:2026-09-16", "type": "fomc_decision", "priority": 100, "facts": {"change_bp": -25, "lower": 4.0, "upper": 4.25}},
        {"id": "regime_change:policy:2026-09-16", "type": "regime_change", "priority": 85, "facts": {"from": "Holding", "to": "Cutting"}},
        {"id": "new_release:CPIAUCSL:2026-08", "type": "new_release", "priority": 80, "facts": {"yoy": 2.9, "prior_yoy": 2.7, "mom": 0.3}},
        {"id": "new_release:CPILFESL:2026-08", "type": "new_release", "priority": 80, "facts": {"yoy": 3.1, "prior_yoy": 3.1, "mom": 0.3}},
        {"id": "new_release:PAYEMS:2026-08", "type": "new_release", "priority": 80, "facts": {"mom_diff": 22, "avg_3": 61}},
        {"id": "revision:PAYEMS:2026-07", "type": "revision", "priority": 50, "facts": {"old": 73, "new": 41}},
        {"id": "new_release:UNRATE:2026-08", "type": "new_release", "priority": 80, "facts": {"level": 4.4, "prior": 4.3}},
        {"id": "delayed:A191RL1Q225SBEA", "type": "delayed", "priority": 40, "facts": {"scheduled": "2026-09-25"}},
    ]
    macro_sources = [
        {"name": "FRED", "url": "https://fred.stlouisfed.org/", "retrieved_at": iso(started + timedelta(seconds=4))},
        {"name": "Federal Reserve Board", "url": "https://www.federalreserve.gov/monetarypolicy.htm", "retrieved_at": iso(started + timedelta(seconds=8))},
        {"name": "BLS", "url": "https://www.bls.gov/", "retrieved_at": iso(started + timedelta(seconds=9))},
    ]
    headline = "The Fed cut 25 bp to 4.00–4.25%; August CPI rose 2.9% YoY (prior 2.7%) as payroll growth slowed to +22K."
    key_stats = [
        {"label": "CPI YoY", "value": 2.9, "format": "percent", "delta": 0.2, "delta_format": "pp_signed", "good_direction": "down"},
        {"label": "10Y yield", "value": 4.12, "format": "percent", "delta": -0.06, "delta_format": "pp_signed", "good_direction": "neutral"},
    ]
    latest = {
        "meta": meta("macro", started, 67, 0.041, macro_sources, smart=(6120, 540)),
        "headline": headline,
        "key_stats": key_stats,
        "regimes": {
            "inflation": {"label": "Cooling", "detail": "Core PCE 2.8% YoY; 2.4% 3-mo annualized"},
            "labor": {"label": "Softening", "detail": "Unemployment 4.4%; payrolls 3-mo avg +61K"},
            "growth": {"label": "Moderate", "detail": "Real GDP +2.1% annualized (Q2)"},
            "policy": {"label": "Cutting", "detail": "Target range 4.00–4.25%"},
            "curve": {"label": "Normal", "detail": "10Y–2Y +0.54 pp; last sign change Sep 2024"},
        },
        "brief": {
            "bullets": [
                {"text": "The FOMC lowered the target range by 25 bp to 4.00–4.25%, its first move since December, citing a shift in the balance of risks toward employment.", "event_ids": ["fomc_decision:2026-09-16"], "citations": [{"name": "Federal Reserve: FOMC statement", "url": "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm"}]},
                {"text": "Headline CPI rose to 2.9% YoY in August from 2.7%, while core CPI held at 3.1%.", "event_ids": ["new_release:CPIAUCSL:2026-08", "new_release:CPILFESL:2026-08"], "citations": [{"name": "FRED: CPIAUCSL", "url": "https://fred.stlouisfed.org/series/CPIAUCSL"}, {"name": "FRED: CPILFESL", "url": "https://fred.stlouisfed.org/series/CPILFESL"}]},
                {"text": "Payrolls rose just 22K in August, and July was revised down to 41K from 73K, pulling the 3-month average to 61K.", "event_ids": ["new_release:PAYEMS:2026-08", "revision:PAYEMS:2026-07"], "citations": [{"name": "FRED: PAYEMS", "url": "https://fred.stlouisfed.org/series/PAYEMS"}]},
                {"text": "Unemployment edged up to 4.4% from 4.3%, keeping the labor regime at Softening.", "event_ids": ["new_release:UNRATE:2026-08"], "citations": [{"name": "FRED: UNRATE", "url": "https://fred.stlouisfed.org/series/UNRATE"}]},
                {"text": "The advance Q3 GDP-related update scheduled for Sep 25 has not appeared on FRED yet and is flagged as delayed.", "event_ids": ["delayed:A191RL1Q225SBEA"], "citations": [{"name": "FRED: A191RL1Q225SBEA", "url": "https://fred.stlouisfed.org/series/A191RL1Q225SBEA"}]},
            ],
            "narrative_source": "llm",
            "model": "claude-sonnet-5",
            "generated_at": iso(started + timedelta(seconds=60)),
            "reused_from_run_id": None,
        },
        "indicators": indicators,
        "yield_curve": {
            "series": {"dates": [d.isoformat() for d in fridays], "y2": y2, "y10": y10, "spread_10y2y": spread},
            "inversion_periods": inv,
            "snapshot": snapshot,
        },
        "fomc": {
            "latest": {
                "date": "2026-09-16",
                "url": "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm",
                "decision": "cut",
                "target_range": {"lower": 4.0, "upper": 4.25},
                "change_bp": -25,
                "votes": {"for_count": 11, "against": [{"name": "Stephen I. Miran", "preferred": "a 50 bp cut"}]},
                "latest_text": latest_text,
                "previous_date": "2026-07-29",
                "previous_text": prev_text,
                "changes": changes,
                "read": {
                    "summary": "The Fed cut its policy rate by a quarter point and said the risks to jobs have grown. It describes growth as slower and job gains as weaker than in July, while noting inflation has moved up. The statement keeps its data-dependent guidance, so it does not commit to further cuts, but the new language about downside risks to employment signals the Committee is more worried about the labor market than about inflation.",
                    "tone_shift": "more_dovish",
                    "rationale": "Changes 1 and 3 downgrade the labor market and add a new judgment that downside risks to employment have risen; change 4 ties the cut to that shift in risks.",
                    "cited_change_idx": [1, 3, 4],
                    "key_phrases": [
                        {"phrase": "job gains have slowed", "interpretation": "The Committee now sees labor demand cooling, not just normalizing."},
                        {"phrase": "downside risks to employment have risen", "interpretation": "The Fed is explicitly weighting the employment side of its mandate more heavily."},
                        {"phrase": "in light of the shift in the balance of risks", "interpretation": "The cut is framed as risk management rather than a response to lower inflation."},
                    ],
                    "narrative_source": "llm",
                },
            },
            "next_meeting": {"start": "2026-10-27", "end": "2026-10-28", "has_sep": False},
            "minutes": {"meeting_date": "2026-07-29", "released_at": "2026-08-19", "url": "https://www.federalreserve.gov/monetarypolicy/fomcminutes20260729.htm", "summary": "Participants generally judged the policy stance as appropriately restrictive. Several noted that labor market conditions had softened and that a reduction in the target range could become appropriate at coming meetings if the data evolved as expected; a few preferred to wait for more evidence that tariff-related price increases would not persist.", "narrative_source": "llm"},
        },
        "calendar": [
            {"date": "2026-09-26", "release": "Personal Income and Outlays", "indicator_ids": ["pce", "core_pce"]},
            {"date": "2026-09-28", "release": "H.15 Selected Interest Rates", "indicator_ids": ["t3m", "t2y", "t5y", "t10y", "t30y"]},
            {"date": "2026-09-30", "release": "Job Openings and Labor Turnover Survey", "indicator_ids": ["jolts"]},
            {"date": "2026-10-01", "release": "Unemployment Insurance Weekly Claims", "indicator_ids": ["claims"]},
            {"date": "2026-10-01", "release": "Primary Mortgage Market Survey", "indicator_ids": ["mortgage30"]},
            {"date": "2026-10-02", "release": "Employment Situation", "indicator_ids": ["payrolls", "unrate", "ahe"]},
            {"date": "2026-10-08", "release": "Unemployment Insurance Weekly Claims", "indicator_ids": ["claims"]},
            {"date": "2026-10-10", "release": "Surveys of Consumers (preliminary)", "indicator_ids": ["umich"]},
        ],
        "events": events,
    }
    write(base / "latest.json", latest)
    write(base / "history" / f"{started.date().isoformat()}.json", latest)
    write(base / "manifest-entry.json", {
        "id": "macro", "name": "Macro & Fed Agent", "route": "/macro", "status": "ok",
        "last_run_at": latest["meta"]["finished_at"], "last_data_change_at": latest["meta"]["finished_at"],
        "expected_interval_hours": 24, "next_run_hint": "Weekdays ~7:00 PT", "headline": headline, "key_stats": key_stats,
        "run_cost_usd": 0.041, "items_count": len(indicators),
    })
    days = {f"2026-09-{d:02d}": 1 for d in range(1, 26) if date(2026, 9, d).weekday() < 5}
    write(base / "costs-summary.json", costs_summary(0.013, days, 0.94))


# --------------------------------------------------------------------------------------
# Grants
# --------------------------------------------------------------------------------------

AGENCIES = [
    ("VETERANS AFFAIRS, DEPARTMENT OF", "TECHNOLOGY ACQUISITION CENTER NJ (36C10B)"),
    ("GENERAL SERVICES ADMINISTRATION", "FEDERAL ACQUISITION SERVICE"),
    ("NATIONAL SCIENCE FOUNDATION", "DIVISION OF ACQUISITION AND COOPERATIVE SUPPORT"),
    ("HEALTH AND HUMAN SERVICES, DEPARTMENT OF", "CENTERS FOR MEDICARE & MEDICAID SERVICES"),
    ("AGRICULTURE, DEPARTMENT OF", "USDA FOREST SERVICE"),
    ("COMMERCE, DEPARTMENT OF", "NATIONAL OCEANIC AND ATMOSPHERIC ADMINISTRATION"),
    ("INTERIOR, DEPARTMENT OF THE", "INTERIOR BUSINESS CENTER"),
    ("ENERGY, DEPARTMENT OF", "OFFICE OF SCIENCE"),
    ("TRANSPORTATION, DEPARTMENT OF", "FEDERAL AVIATION ADMINISTRATION"),
    ("SMALL BUSINESS ADMINISTRATION", "OFFICE OF THE CHIEF INFORMATION OFFICER"),
    ("HOMELAND SECURITY, DEPARTMENT OF", "CYBERSECURITY AND INFRASTRUCTURE SECURITY AGENCY"),
    ("EDUCATION, DEPARTMENT OF", "FEDERAL STUDENT AID"),
]
TITLES = [
    "Cloud Modernization Support Services", "Data Platform Engineering and Analytics", "Legacy Application Modernization (.NET to Cloud)",
    "Agile Software Development Services", "Enterprise Dashboard and Reporting Tool", "API Gateway Implementation and Support",
    "Machine Learning Model Operations Support", "DevSecOps Pipeline Modernization", "Web Application Accessibility Remediation",
    "Research Data Pipeline Development", "Digital Services Discovery Sprint", "Case Management System Enhancements",
    "Artificial Intelligence Pilot for Document Intake", "Cloud Migration Assessment (AWS GovCloud)", "Public Website Redesign and CMS Migration",
    "Open Data Portal Operations and Maintenance", "Geospatial Data Processing Services", "Customer Experience Survey Platform",
    "SBIR Phase I: AI for Wildfire Risk Forecasting", "Cybersecurity Workforce Training Platform", "Data Warehouse Optimization",
    "Mobile Application Development Services", "Grants Management System Integration", "Identity and Access Management Modernization",
    "Scientific Software Sustainability Grants", "Records Digitization and Search", "Help Desk Automation with LLMs",
    "Salesforce Platform Configuration Support", "PostgreSQL Database Administration Services", "Performance Dashboard for Program Metrics",
    "Low-Code Workflow Automation", "Technical Assistance for Rural Broadband Data", "Business Intelligence Tool Licenses and Support",
    "Janitorial Services for Field Office", "Construction of Visitor Center Parking Lot", "Fleet Vehicle Maintenance",
    "Medical Equipment Maintenance", "Environmental Sensor Network Data Integration", "Natural Language Search for Regulations",
    "Content Management and Translation Services", "Section 508 Testing Services", "Innovation Challenge: Digital Public Infrastructure",
]
TYPES = [
    ("solicitation", "Solicitation"), ("combined_synopsis_solicitation", "Combined Synopsis/Solicitation"),
    ("presolicitation", "Presolicitation"), ("sources_sought", "Sources Sought"),
]
SET_ASIDES = [None, "Total Small Business Set-Aside", "Partial Small Business Set-Aside", None, "Total Small Business Set-Aside"]
NAICS = ["541511", "541512", "541519", "518210", "541690", "541611", "541715"]


def agency_name(a: str) -> str:
    """"VETERANS AFFAIRS, DEPARTMENT OF" → "The Department of Veterans Affairs"."""
    small = {"of", "and", "the", "for"}
    parts = [p.strip() for p in a.split(",")]
    name = f"{parts[1]} {parts[0]}" if len(parts) == 2 else parts[0]
    words = [w.lower() if w.lower() in small and i else w.capitalize() for i, w in enumerate(name.split())]
    return "The " + " ".join(words)


def build_grants(started: datetime):
    base = OUT / "grants"
    if base.exists():
        shutil.rmtree(base)
    today = started.date()
    rows = []
    items = []
    for i in range(96):
        is_grant = i % 7 == 3
        title = TITLES[i % len(TITLES)] + ("" if i < len(TITLES) else f" ({['Phase II', 'Region 4', 'Recompete', 'Option Year'][i % 4]})")
        ag, office = AGENCIES[(i * 5) % len(AGENCIES)]
        if is_grant:
            ag = ["NATIONAL SCIENCE FOUNDATION", "ENERGY, DEPARTMENT OF", "AGRICULTURE, DEPARTMENT OF", "COMMERCE, DEPARTMENT OF"][i % 4]
        nt, ntl = ("grant", "Grant") if is_grant else TYPES[i % len(TYPES)]
        if is_grant and i % 3 == 0:
            nt, ntl = "forecast", "Forecast"
        sid = f"{RNG.randrange(16**32):032x}"
        id_ = (f"grants_gov:{350000 + i * 37}" if is_grant else f"sam:{sid}")
        posted = today - timedelta(days=RNG.randint(0, 24))
        days_left = RNG.randint(4, 58)
        if i in (0, 5):
            days_left = [19, 6][i // 5]
        dl_date = today + timedelta(days=days_left)
        deadline = f"{dl_date.isoformat()}T{RNG.choice(['16:00:00', '17:00:00', '14:00:00'])}-04:00"
        naics = [] if is_grant else [NAICS[(i * 3) % len(NAICS)]]
        relevance = max(5, min(100, int(95 - i * 0.9 + RNG.uniform(-8, 8))))
        neg = any(w in title.lower() for w in ("janitorial", "construction", "vehicle", "medical equipment"))
        if neg:
            relevance = RNG.randint(5, 15)
        scored = relevance >= 25 and not neg
        if scored:
            cap = min(40, int(relevance * 0.42 + RNG.uniform(-4, 4)))
            sub = {"capability": max(5, cap), "eligibility": RNG.randint(11, 20), "size": RNG.randint(5, 14), "timeline": RNG.randint(5, 15), "strategic": RNG.randint(2, 10)}
            fit = sum(sub.values())
            fit = min(fit, 96)
        else:
            sub, fit = None, None
        rec = None if fit is None else ("Pursue" if fit >= 75 else ("Consider" if fit >= 55 else "Pass"))
        amount = None
        vkind = "none"
        if is_grant:
            amount = RNG.choice([150000, 275000, 500000, 1000000, None])
            vkind = "award_ceiling" if amount else "none"
        elif i % 4 == 1:
            amount = RNG.choice([180000, 450000, 1200000, 2600000, 4200000])
            vkind = "estimate"
        reasons = []
        if naics and naics[0] in ("541511", "541512"):
            reasons.append(f"NAICS {naics[0]} primary match")
        elif naics:
            reasons.append(f"NAICS {naics[0]} secondary match")
        kw = [k for k in ("data", "cloud", "software", "dashboard", "api", "machine learning", "modernization", "devsecops", "ai", "web") if k in title.lower()]
        if kw:
            reasons.append(f"Keyword: {kw[0]}")
        sa = None if is_grant else SET_ASIDES[i % len(SET_ASIDES)]
        if sa:
            reasons.append("Small business set-aside")
        if ag in ("GENERAL SERVICES ADMINISTRATION", "VETERANS AFFAIRS, DEPARTMENT OF", "NATIONAL SCIENCE FOUNDATION"):
            reasons.append("Target agency")
        reasons = reasons[:3]
        item = {
            "id": id_, "source": "grants_gov" if is_grant else "sam", "kind": "grant" if is_grant else "contract",
            "notice_type": nt, "notice_type_label": ntl, "title": title,
            "solicitation_number": None if is_grant else f"{['36C10B', '47QTCA', '140D04', '75FCMC', '12805B'][i % 5]}26{['Q', 'R'][i % 2]}{1000 + i * 13:04d}",
            "agency": ag, "office": office, "naics": naics, "psc": None if is_grant else ["DA01", "DA10", "DB10", "R408", "R499", "DJ01"][i % 6],
            "set_aside_label": sa, "posted_date": posted.isoformat(), "deadline": deadline, "days_left": days_left,
            "place": RNG.choice(["Remote", "Remote / Washington, DC", "Denver, CO", "Austin, TX", "Anywhere in the U.S."]),
            "value": {"kind": vkind, "amount": amount, "floor": (25000 if vkind == "award_ceiling" else None)},
            "url": (f"https://www.grants.gov/search-results-detail/{350000 + i * 37}" if is_grant else f"https://sam.gov/opp/{sid}/view"),
            "fit": fit, "sub_scores": sub, "recommendation": rec,
            "confidence": None if fit is None else RNG.choice(["high", "high", "medium", "low"]),
            "reasons": reasons, "red_flags": [], "is_new": (today - posted).days <= 0 or i in (0, 2, 4, 9, 13, 17, 21),
            "changed": i in (6, 11), "relevance": relevance,
        }
        if item["fit"] is not None and i % 9 == 4:
            item["red_flags"] = ["Incumbent strongly implied"]
        if item["fit"] is not None and i == 8:
            item["red_flags"] = ["On-site work in Anchorage, AK"]
        items.append(item)

    # Force a clear leader matching the spec example.
    items[0].update({"fit": 86, "sub_scores": {"capability": 36, "eligibility": 18, "size": 11, "timeline": 13, "strategic": 8}, "recommendation": "Pursue", "confidence": "high", "title": "Cloud Modernization Support Services", "agency": "VETERANS AFFAIRS, DEPARTMENT OF", "naics": ["541512"], "set_aside_label": "Total Small Business Set-Aside", "reasons": ["NAICS 541512 primary match", "Python/React modernization scope", "Small business set-aside"], "is_new": True})
    scored = [x for x in items if x["fit"] is not None]
    scored.sort(key=lambda x: (-x["fit"], x["days_left"]))
    top = scored[:20]
    for rank, x in enumerate(top):
        x["_in_top"] = True
        bits = x["title"].lower()
        x["summary"] = {
            "what_they_want": f"{agency_name(x['agency'])} is seeking a contractor for {bits}. The work covers design, build and ongoing support. Place of performance: {x['place']}.",
            "why_fit": [r for r in x["reasons"]][:2] or ["Keywords overlap with the profile"],
            "risks": (x["red_flags"] or []) + (["Value not disclosed; scope may exceed a 5-person team"] if x["value"]["amount"] is None else []) + (["Short response window"] if x["days_left"] < 10 else []),
            "next_steps": ["Confirm SAM registration is active", "Read the attachments and Q&A deadline on the official listing", "Draft a 1-page capability statement tailored to this scope"],
            "narrative_source": "template" if rank in (7, 13) else "llm",
            "model": None if rank in (7, 13) else "claude-sonnet-5",
            "generated_at": iso(started + timedelta(seconds=300 + rank * 3)),
        }
    top_matches = []
    for x in top[:20]:
        tm = {k: x[k] for k in ["id", "source", "kind", "notice_type", "notice_type_label", "title", "solicitation_number", "agency", "office", "naics", "psc", "set_aside_label", "posted_date", "deadline", "days_left", "place", "value", "url", "fit", "sub_scores", "recommendation", "confidence", "reasons", "red_flags", "is_new", "changed", "summary"]}
        top_matches.append(tm)
    active = [x for x in items if x["fit"] is not None and x["fit"] >= 25]
    rows_sorted = sorted(items, key=lambda x: (-(x["fit"] if x["fit"] is not None else -1), -x["relevance"]))
    for x in rows_sorted:
        rows.append({
            "id": x["id"], "source": x["source"], "kind": x["kind"], "type": x["notice_type_label"], "title": x["title"],
            "agency": x["agency"], "naics": x["naics"], "set_aside": (x["set_aside_label"] or "").replace(" Set-Aside", "") or None,
            "posted": x["posted_date"], "deadline": x["deadline"], "value": x["value"]["amount"], "fit": x["fit"],
            "relevance": x["relevance"], "recommendation": x["recommendation"], "reasons": x["reasons"], "url": x["url"],
            "is_new": x["is_new"], "in_top": bool(x.get("_in_top")),
        })
    # remove negative-keyword rows (hard filter rejects never reach all.json)
    rows = [r for r in rows if not any(w in r["title"].lower() for w in ("janitorial", "construction", "vehicle", "medical equipment"))]
    new_count = sum(1 for x in items if x["is_new"] and x["fit"] is not None)
    closing = sum(1 for x in active if x["days_left"] <= 14)
    largest = max((x for x in active if x["value"]["amount"]), key=lambda x: x["value"]["amount"])
    headline = f"{new_count} new matches today; {closing} close within 14 days. Top: {top[0]['title']} (VA), fit {top[0]['fit']}."
    key_stats = [
        {"label": "New matches today", "value": new_count, "format": "count", "good_direction": "up"},
        {"label": "Closing ≤ 14 days", "value": closing, "format": "count", "good_direction": "neutral"},
    ]
    dl30 = sorted([x for x in top if x["days_left"] <= 30], key=lambda x: x["deadline"])
    g_sources = [
        {"name": "SAM.gov Contract Opportunities", "url": "https://sam.gov/", "retrieved_at": iso(started + timedelta(seconds=6))},
        {"name": "Grants.gov", "url": "https://www.grants.gov/", "retrieved_at": iso(started + timedelta(seconds=9))},
    ]
    latest = {
        "meta": meta("grants", started, 1420, 0.093, g_sources, fast=(212000, 31000), smart=(48000, 9200), extra={"sam_budget_exhausted": False, "sam_requests_used": 3}),
        "headline": headline,
        "key_stats": key_stats,
        "profile": {
            "id": "default", "name": "Small software consultancy", "naics": ["541511", "541512"],
            "set_asides_eligible": ["Total Small Business (SBA)", "Partial Small Business (SBP)"],
            "keywords_preview": ["software development", "data pipeline", "cloud migration", "API"],
            "profile_hash": "9f2c4be1d07a5e3c8b16f0a2d4e9c7b3a1f5d8e2c6b0a4f7e3d9c1b5a8f2e6d0",
        },
        "thresholds": {"relevance": 25, "pursue": 75, "consider": 55},
        "stats": {
            "new_since_last_run": new_count, "closing_within_14d": closing, "active_matches": len(active),
            "largest_value": {"amount": largest["value"]["amount"], "id": largest["id"], "title": largest["title"]},
            "fetched": {"sam": 912, "grants_gov": 188},
            "rejected": {"deadline": 120, "type": 310, "set_aside": 88, "eligibility": 40, "value": 12, "place": 0, "negative_keyword": 95},
            "below_relevance": 402, "llm_scored_this_run": 31, "llm_scored_cached": 118,
        },
        "top_matches": top_matches,
        "deadlines_30d": [{"id": x["id"], "title": x["title"], "deadline": x["deadline"], "recommendation": x["recommendation"], "fit": x["fit"]} for x in dl30],
        "sources": [{"name": "SAM.gov Contract Opportunities", "url": "https://sam.gov/"}, {"name": "Grants.gov", "url": "https://www.grants.gov/"}],
        "disclaimer": "Automated screening. Always read the official notice and attachments before acting.",
    }
    write(base / "latest.json", latest)
    write(base / "all.json", {"generated_at": latest["meta"]["finished_at"], "rows": rows})
    write(base / "history" / f"{started.date().isoformat()}.json", latest)
    write(base / "manifest-entry.json", {
        "id": "grants", "name": "Grants & Contracts Agent", "route": "/grants", "status": "ok",
        "last_run_at": latest["meta"]["finished_at"], "last_data_change_at": latest["meta"]["finished_at"],
        "expected_interval_hours": 24, "next_run_hint": "Daily 06:00 PT", "headline": headline, "key_stats": key_stats,
        "run_cost_usd": 0.093, "items_count": len(active),
    })
    write(base / "costs-summary.json", costs_summary(0.09, {f"2026-09-{d:02d}": 1 for d in range(1, 27)}, 3.40))


# --------------------------------------------------------------------------------------
# Repo maintenance
# --------------------------------------------------------------------------------------


def build_repo_maint(started: datetime):
    base = OUT / "repo_maint"
    if base.exists():
        shutil.rmtree(base)
    weeks = [f"2026-W{w:02d}" for w in range(28, 40)]
    specs = [
        ("Kghaffari26/agents-core", "own", 0.0, "v0.1.0", "2026-09-10"),
        ("Kghaffari26/real-estate-agent", "own", 0.0, None, None),
        ("Kghaffari26/fed-agent", "own", 0.0, None, None),
        ("Kghaffari26/sam-agent", "own", 0.0, None, None),
        ("Kghaffari26/agents-hub", "own", 0.0, "v0.3.0", "2026-08-20"),
        ("Kghaffari26/agents-hub-sandbox", "sandbox", 0.0, "v0.1.2", "2026-07-02"),
    ]
    repos = []
    actions = []
    triage_pool = [
        ("Map doesn't render on Safari 17", "bug", "p2", ["bug", "area: site"], ["Browser console output", "Steps to reproduce"], "Leaflet map stays blank on Safari 17; likely a CSS or dynamic-import issue."),
        ("FRED 429 errors on Monday runs", "bug", "p1", ["bug", "area: fetch"], ["Run ID of a failing run"], "Monday runs hit FRED rate limits; the retry backoff may be too short."),
        ("Add Zillow rent to metro compare", "feature", "p3", ["enhancement"], [], "Request to show Zillow rent index alongside price in the compare chart."),
        ("How do I change the business profile?", "question", "p3", ["question"], [], "User asks where the grants profile lives and how to edit it."),
        ("Docs: explain the data branch layout", "docs", "p3", ["documentation"], [], "README should document the files on the data branch."),
        ("Pin actions to SHAs", "chore", "p3", ["chore"], [], "Workflow actions should be pinned to commit SHAs for supply-chain safety."),
        ("Payroll revision badge shows wrong sign", "bug", "p2", ["bug"], ["Screenshot", "Which indicator card"], "Revision badge renders +41K as a decrease; formatting bug."),
        ("CSV export drops quotes in titles", "bug", "p2", ["bug", "area: site"], ["Example row"], "Titles containing quotes break the exported CSV."),
    ]
    for ri, (full, role, _, tag, tag_date) in enumerate(specs):
        opened = [RNG.randint(0, 6) for _ in weeks]
        closed = [max(0, o + RNG.randint(-2, 2)) for o in opened]
        triage = []
        n_tri = [2, 1, 1, 2, 3, 2][ri]
        for k in range(n_tri):
            t = triage_pool[(ri * 2 + k) % len(triage_pool)]
            num = 40 + ri * 7 + k
            created = started - timedelta(days=RNG.randint(1, 16), hours=RNG.randint(0, 20))
            dups = []
            if t[0].startswith("Map doesn't"):
                dups = [{"number": 31, "url": f"https://github.com/{full}/issues/31", "title": "Map tiles blank on iOS Safari", "similarity": 0.58, "state": "closed"}]
            if t[0].startswith("CSV export"):
                dups = [{"number": 29, "url": f"https://github.com/{full}/issues/29", "title": "Exported CSV has broken columns", "similarity": 0.51, "state": "open"}]
            applied = {"labels": t[3] if role == "sandbox" else [], "commented": role == "sandbox"}
            triage.append({
                "number": num, "title": t[0], "url": f"https://github.com/{full}/issues/{num}", "author": ["dana-dev", "mkoh", "octo-reader", "lee-js", "p-alvarez"][(ri + k) % 5],
                "created_at": iso(created), "classification": t[1], "priority": t[2], "confidence": ["high", "medium", "high", "low"][(ri + k) % 4],
                "suggested_labels": t[3], "missing_info": t[4], "summary": t[5], "duplicates": dups, "applied": applied, "cached": k % 2 == 0,
            })
            if role == "sandbox":
                actions.append({"repo": full, "type": "add_labels", "target": num, "detail": t[3], "status": "applied", "reason": None})
                actions.append({"repo": full, "type": "comment", "target": num, "detail": "triage comment", "status": "applied", "reason": None})
            else:
                actions.append({"repo": full, "type": "add_labels", "target": num, "detail": t[3], "status": "planned", "reason": "report mode"})
        untri_7d = sum(1 for t in triage if (started - datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))).days > 7)
        stale = []
        if ri in (0, 4, 5):
            prs = {
                0: [("Retry budget per host", "mkoh", 18, "review_requested", "success")],
                4: [("Add Zillow rent overlay", "Kghaffari26", 23, "changes_requested", "success"), ("Bump recharts to v3", "dependabot[bot]", 16, "approved", "failure")],
                5: [("Seed issues for demo", "Kghaffari26", 31, "none", "none")],
            }[ri]
            for j, (title, author, age, rs, cs) in enumerate(prs):
                num = 10 + ri * 3 + j
                if rs == "changes_requested":
                    nudge = f"Hi @{author}, just checking in on this one. Are you still planning to address the requested changes? Happy to help if anything's unclear."
                elif rs == "approved" and cs == "failure":
                    nudge = "This is approved but CI is failing (test (ubuntu-latest, 22)). Could you take a look when you get a chance?"
                elif rs == "approved":
                    nudge = "This looks ready. Maintainers, is anything blocking a merge?"
                else:
                    nudge = f"This PR has been waiting {age} days for review. @maintainers, could someone take a look?"
                stale.append({"number": num, "title": title, "url": f"https://github.com/{full}/pull/{num}", "author": author, "age_days": age,
                              "last_activity_at": iso(started - timedelta(days=age - 2)), "review_state": rs, "ci_state": cs, "nudge": nudge})
        frh = [80.5, 12.0, 30.2, None, 80.5, 190.0][ri]
        ci = ["success", "success", "failure", "success", "success", "pending"][ri]
        breakdown = []
        if untri_7d:
            breakdown.append({"reason": f"{untri_7d} untriaged issue{'s' if untri_7d != 1 else ''} older than 7 days", "points": -3 * untri_7d})
        if stale:
            breakdown.append({"reason": f"{len(stale)} stale PR{'s' if len(stale) != 1 else ''}", "points": -5 * len(stale)})
        if frh is not None and frh > 72:
            breakdown.append({"reason": f"Median first response {frh:.0f}h", "points": -15 if frh > 168 else -10})
        if ci == "failure":
            breakdown.append({"reason": "Default branch CI failing", "points": -20})
        if ri in (1, 2, 3):
            breakdown.append({"reason": "No CONTRIBUTING file", "points": -3})
        score = 100 + sum(b["points"] for b in breakdown)
        grade = "A" if score >= 90 else "B" if score >= 80 else "C" if score >= 70 else "D" if score >= 60 else "F"
        open_prs = len(stale) + RNG.randint(0, 3)
        name = full.split("/")[1]
        if tag:
            md = (
                f"## [{'0.4.0' if name == 'agents-hub' else '0.2.0' if name == 'agents-core' else '0.1.3'}] - Unreleased\n\n"
                "### Added\n- Metro compare mode with up to 3 metros (#23)\n- Mortgage-rate overlay on the compare chart (#25)\n\n"
                "### Changed\n- Grants table now paginates at 25 rows (#27)\n\n"
                "### Fixed\n- Sparkline no longer draws nulls as zero (#26)\n- Dark-mode contrast on stat deltas (#28)\n"
            ) if name == "agents-hub" else (
                f"## [{'0.2.0' if name == 'agents-core' else '0.1.3'}] - Unreleased\n\n"
                "### Added\n- `guard_batch` for Batch API results (#14)\n\n### Fixed\n- Cost summary counted retries twice (`costs.py`) (#15)\n"
            )
            changelog = {
                "base_ref": tag, "base_date": tag_date, "source": "pull_requests" if name != "agents-hub-sandbox" else "commits",
                "item_count": 5 if name == "agents-hub" else 2, "suggested_version": "0.4.0" if name == "agents-hub" else ("0.2.0" if name == "agents-core" else "0.1.3"),
                "markdown": md, "narrative_source": "llm" if name != "agents-hub-sandbox" else "template", "model": "claude-sonnet-5" if name != "agents-hub-sandbox" else None,
                "generated_at": iso(started + timedelta(seconds=40)), "cached": name == "agents-core",
            }
        else:
            changelog = None
        repos.append({
            "full_name": full, "url": f"https://github.com/{full}", "role": role, "allow_apply": role == "sandbox", "partial": ri == 3,
            "health": {"score": score, "grade": grade, "breakdown": breakdown},
            "counts": {"open_issues": len(triage) + RNG.randint(1, 6), "untriaged": len(triage), "untriaged_over_7d": untri_7d, "open_prs": open_prs, "stale_prs": len(stale), "no_response_count": RNG.randint(0, 2)},
            "median_first_response_hours": frh, "ci_default_branch": ci,
            "days_since_release": None if not tag_date else (started.date() - date.fromisoformat(tag_date)).days,
            "activity_12w": {"weeks": weeks, "opened": opened, "closed": closed},
            "triage": triage, "stale_prs": stale, "changelog": changelog,
        })
    actions.append({"repo": "Kghaffari26/agents-hub", "type": "comment", "target": 42, "detail": "triage comment", "status": "planned", "reason": "report mode"})
    actions.append({"repo": "Kghaffari26/sam-agent", "type": "add_labels", "target": 61, "detail": ["question"], "status": "skipped", "reason": "partial data: rate limit reached"})
    untri = sum(r["counts"]["untriaged"] for r in repos)
    avg_health = round(sum(r["health"]["score"] for r in repos) / len(repos))
    n_stale = sum(len(r["stale_prs"]) for r in repos)
    headline = f"{len(repos)} repos watched: {untri} issues triaged, {n_stale} stale PRs, changelog ready for agents-hub (v0.4.0 suggested)."
    key_stats = [
        {"label": "Untriaged issues", "value": untri, "format": "count", "good_direction": "down"},
        {"label": "Avg health", "value": avg_health, "format": "count", "good_direction": "up"},
    ]
    latest = {
        "meta": meta("repo_maint", started, 94, 0.028, [{"name": "GitHub REST API", "url": "https://docs.github.com/en/rest", "retrieved_at": iso(started + timedelta(seconds=3))}], fast=(22400, 3100), smart=(6100, 900), extra={"github_requests": 212, "github_304s": 180}),
        "headline": headline,
        "key_stats": key_stats,
        "mode": "apply",
        "repos": repos,
        "actions": actions,
    }
    write(base / "latest.json", latest)
    write(base / "history" / f"{started.date().isoformat()}.json", latest)
    write(base / "manifest-entry.json", {
        "id": "repo_maint", "name": "Repo Maintenance Agent", "route": "/repos", "status": "ok",
        "last_run_at": latest["meta"]["finished_at"], "last_data_change_at": latest["meta"]["finished_at"],
        "expected_interval_hours": 24, "next_run_hint": "Daily 07:00 PT", "headline": headline, "key_stats": key_stats,
        "run_cost_usd": 0.028, "items_count": len(repos),
    })
    write(base / "costs-summary.json", costs_summary(0.025, {f"2026-09-{d:02d}": 1 for d in range(1, 27)}, 0.61))


if __name__ == "__main__":
    build_real_estate(datetime(2026, 9, 25, 15, 0, 6, tzinfo=UTC))
    build_macro(datetime(2026, 9, 25, 14, 0, 5, tzinfo=UTC))
    build_grants(datetime(2026, 9, 26, 13, 0, 3, tzinfo=UTC))
    build_repo_maint(datetime(2026, 9, 26, 14, 0, 2, tzinfo=UTC))
    total = sum(p.stat().st_size for p in OUT.rglob("*.json"))
    print(f"fixtures written to {OUT.relative_to(ROOT)} ({total / 1024:.0f} KB)")
