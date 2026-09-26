#!/usr/bin/env python3
"""Copy a real agent run (its publish dir / data branch) into test/fixtures/real/<name>/, trimmed.

    python3 scripts/trim_real_fixture.py <agent-id> <publish-dir> [<name>]

Keeps latest.json, manifest-entry.json, costs-summary.json and the agent's extra files, so the
contract tests pin the shapes agents really publish. Trimming only shortens arrays (columnar
series to the last 24 points, metro list and metro files to 6, all.json to 25 rows); it never
edits a value, so every kept object is exactly what the agent wrote. schema.json and history/
are skipped (history snapshots are latest.json copies).
"""

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERIES_KEEP = 24
METROS_KEEP = 6
ROWS_KEEP = 25


def trim_series(o):
    """Shorten every columnar block ({dates: [...], <key>: [same length], ...}) to its last points."""
    if isinstance(o, dict):
        dates = o.get("dates")
        if isinstance(dates, list) and len(dates) > SERIES_KEEP:
            n = len(dates)
            for k, v in list(o.items()):
                if isinstance(v, list) and len(v) == n:
                    o[k] = v[-SERIES_KEEP:]
        for v in o.values():
            trim_series(v)
    elif isinstance(o, list):
        for v in o:
            trim_series(v)
    return o


def dump(obj, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n")


def main():
    agent, src = sys.argv[1], Path(sys.argv[2])
    name = sys.argv[3] if len(sys.argv) > 3 else agent
    dest = ROOT / "test" / "fixtures" / "real" / name
    shutil.rmtree(dest, ignore_errors=True)
    for rel in ("manifest-entry.json", "costs-summary.json"):
        dump(json.loads((src / rel).read_text()), dest / rel)
    latest = trim_series(json.loads((src / "latest.json").read_text()))
    if agent == "real_estate":
        latest["metros"] = latest["metros"][:METROS_KEEP]
        for m in latest["metros"]:
            dump(trim_series(json.loads((src / "metros" / f"{m['slug']}.json").read_text())), dest / "metros" / f"{m['slug']}.json")
    if agent == "grants" and (src / "all.json").exists():
        all_ = json.loads((src / "all.json").read_text())
        all_["rows"] = all_["rows"][:ROWS_KEEP]
        dump(all_, dest / "all.json")
    dump(latest, dest / "latest.json")
    print(f"wrote {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
