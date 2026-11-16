#!/usr/bin/env python3
"""Interactive check of a chess-lesson run (RUN_PROTOCOL.md section 4).

  bin/chess_check.py RUN_DIR ADAPTER [--reference FILE]

ADAPTER names harness/checks/chess/adapters/<ADAPTER>.mjs, which says how to
read that lesson's drawn board, steps and controls (lessons are free-form, so
each needs one; copy the closest). Runs harness/checks/chess/validate.mjs in
the pinned harness image with no network, the workspace read-only and the
pinned three.js mounted where the scene expects it. Writes, beside the run:
  interaction-validation.json   per-ply positions as drawn, capture restore,
                                previous, replay, autoplay per step, pause,
                                mobile overflow
  validation/*.png              screenshots
The run's record and workspace are not changed. Editorial conclusions belong
in trial-review.json, written separately.
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "bin"))
import run as R  # noqa: E402

CHESS = ROOT / "harness" / "checks" / "chess"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("run")
    ap.add_argument("adapter")
    ap.add_argument("--reference", default=str(CHESS / "scholars-mate-reference.json"))
    args = ap.parse_args()
    run = Path(args.run).resolve()
    adapter = CHESS / "adapters" / f"{args.adapter}.mjs"
    if not adapter.is_file():
        sys.exit(f"no adapter {adapter}; available: {sorted(p.stem for p in (CHESS / 'adapters').glob('*.mjs'))}")
    vendor = R.HARNESS / "vendor" / f"three-{R.THREE_VERSION}"
    if not (vendor / "build").is_dir():
        sys.exit(f"missing {vendor}; run harness/fetch_vendor.sh")
    out = run / "validation"
    out.mkdir(exist_ok=True)
    cmd = ["docker", "run", "--rm", "--network", "none", "--cap-drop", "ALL",
           "--security-opt", "no-new-privileges", "--user", f"{os.getuid()}:{os.getgid()}",
           "-v", f"{run / 'workspace'}:/work:ro", "-v", f"{vendor}:/work/vendor/three:ro",
           "-v", f"{Path(args.reference).resolve()}:/reference.json:ro",
           "-v", f"{CHESS / 'validate.mjs'}:/validate.mjs:ro", "-v", f"{adapter}:/adapter.mjs:ro",
           "-v", f"{out}:/out", R.IMAGE, "node", "/validate.mjs"]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    report = out / "interaction-validation.json"
    if res.returncode or not report.exists():
        sys.exit(f"validation failed (exit {res.returncode}):\n{res.stderr[-3000:]}")
    data = json.loads(report.read_text())
    data["adapter"] = args.adapter
    data["harness_image"] = R.image_info()
    (run / "interaction-validation.json").write_text(json.dumps(data, indent=2))
    report.unlink()
    summary = {k: data.get(k) for k in ("all_positions_match", "autoplay_never_wrong", "capture_restored",
                                        "previous_steps_back", "replay_initial", "autoplay_final_board",
                                        "pause", "mobile_no_horizontal_overflow")}
    summary["page_errors"] = len(data.get("page_errors") or [])
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
