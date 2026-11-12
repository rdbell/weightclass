#!/usr/bin/env python3
"""Recompute what can be derived after a run, without touching its record.

  bin/backfill.py RUN_DIR... [--recheck]

Adds to meta.json (keeps every original field; adds a "backfill" block):
  - token totals over every model request (run.raw_token_totals): main
    session and sub-agents; reasoning reported or estimated (method kept).
  - end reason under the cap that applied: a run that used all of its
    guard.max_steps is marked "step cap (N)".
  - prompt identity under the current prompt file when the run used an
    older id for byte-identical text (e.g. toon-eiffel -> eiffel-spec).
--recheck re-runs the judged render with the current scene check when the
run's checks.json is older (the original is kept as checks.v1.json).
"""
import argparse
import gzip
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "bin"))
import run as R  # noqa: E402

CHECK_VERSION = 2


def prompt_index():
    out = {}
    for f in (ROOT / "prompts").rglob("*.md"):
        meta, text = R.read_brief(f)
        if meta.get("id"):
            out[hashlib.sha256(text.encode()).hexdigest()] = (f, meta)
    return out


def recheck(run):
    checks = run / "checks.json"
    if checks.exists() and json.loads(checks.read_text()).get("check_version", 1) >= CHECK_VERSION:
        return False
    meta = json.loads((run / "meta.json").read_text())
    pmeta = prompt_index().get(meta["prompt"]["sha256"], (None, {}))[1]
    inp = run / "input"
    inp.mkdir(exist_ok=True)
    modes = [m.strip() for m in pmeta.get("modes", "").split(",") if m.strip()]
    (inp / "check.json").write_text(json.dumps({"modes": modes, "mode_param": pmeta.get("mode_param")}))
    if checks.exists():
        checks.rename(run / "checks.v1.json")
    vendor = R.HARNESS / "vendor" / f"three-{R.THREE_VERSION}"
    uid = subprocess.run(["id", "-u"], capture_output=True, text=True).stdout.strip()
    gid = subprocess.run(["id", "-g"], capture_output=True, text=True).stdout.strip()
    subprocess.run(["docker", "run", "--rm", "--network", "none", "--user", f"{uid}:{gid}",
                    "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
                    "-v", f"{run / 'workspace'}:/work", "-v", f"{vendor}:/work/vendor/three:ro",
                    "-v", f"{run}:/judged", R.IMAGE, "node", "/opt/weightclass/scene.mjs",
                    "check", "/work", "/judged"], check=False)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("runs", nargs="+")
    ap.add_argument("--recheck", action="store_true")
    args = ap.parse_args()
    prompts = prompt_index()
    for r in args.runs:
        run = Path(r).resolve()
        meta = json.loads((run / "meta.json").read_text())
        bf = {}
        if args.recheck:
            bf["rechecked"] = recheck(run)
        tot = R.raw_token_totals(run / "record" / "raw")
        if tot:
            bf["tokens_raw"] = tot
        cap = ((meta.get("harness") or {}).get("guard") or {}).get("max_steps")
        steps = (meta.get("tokens") or {}).get("steps")
        if cap and steps and steps >= cap and not str(meta.get("end_reason", "")).startswith("guard"):
            bf["end_reason"] = f"step cap ({cap})"
        hit = prompts.get(meta["prompt"]["sha256"])
        if hit:
            pmeta = hit[1]
            bf["prompt"] = {"id": pmeta["id"], "title": pmeta.get("title"), "variant": pmeta.get("variant"),
                            "subject": pmeta.get("subject"), "version": pmeta.get("version"),
                            "file": str(hit[0].relative_to(ROOT))}
        meta["backfill"] = bf
        (run / "meta.json").write_text(json.dumps(meta, indent=2))
        print(run.name, json.dumps({k: v for k, v in bf.items() if k != "prompt"}))


if __name__ == "__main__":
    main()
