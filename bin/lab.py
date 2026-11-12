#!/usr/bin/env python3
"""Prompt lab: try a draft brief on several hosted models at once.

  OPENROUTER_API_KEY=... bin/lab.py prompts/lab/my-draft.md \
      [--setups or-ds1017-fast,or-glm53flash-fast,or-qwen27-fast] \
      [--samples 1] [--yes]

Prints a rough cost estimate and asks before starting (--yes skips the
question). Runs bin/run.py --lab for every setup x sample in parallel,
records the key's actual spend for the batch, and writes
lab/<batch>/index.html: screenshots, checks and transcripts side by side.
Lab runs are never published; see SPEC.md "Prompt lab".
"""
import argparse
import datetime
import html
import json
import os
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Rough per-run token use for the estimate: an agent run re-reads its growing
# context every step. Actual spend is measured from the key afterwards.
EST_INPUT, EST_OUTPUT = 150_000, 25_000


def openrouter(path, key=None):
    req = urllib.request.Request(f"https://openrouter.ai/api/v1{path}")
    if key:
        req.add_header("Authorization", f"Bearer {key}")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def key_usage(key):
    try:
        return float(openrouter("/key", key)["data"]["usage"])
    except Exception:
        return None


def estimate(setups, samples):
    prices = {m["id"]: m["pricing"] for m in openrouter("/models")["data"]}
    total, lines = 0.0, []
    for s in setups:
        p = prices.get(s["model_id"])
        if not p:
            lines.append(f"  {s['id']}: price unknown")
            continue
        cost = samples * (EST_INPUT * float(p["prompt"]) + EST_OUTPUT * float(p["completion"]))
        total += cost
        lines.append(f"  {s['id']}: ~${cost:.3f} for {samples} run(s)")
    return total, lines


def transcript_html(run):
    events = run / "record" / "events.jsonl"
    rows = []
    if events.exists():
        for line in events.read_text().splitlines():
            try:
                e = json.loads(line)
            except ValueError:
                continue
            p = e.get("part") or {}
            if e.get("type") == "text" and p.get("text"):
                rows.append(f"<div class=t><b>assistant</b><pre>{html.escape(p['text'])}</pre></div>")
            elif e.get("type") == "tool_use":
                st = p.get("state") or {}
                inp = json.dumps(st.get("input"), indent=1)
                out = str(st.get("output") or st.get("error") or "")
                rows.append(
                    f"<div class=c><b>{html.escape(str(p.get('tool')))}</b>"
                    f"<pre>{html.escape(inp[:4000])}</pre>"
                    f"<details><summary>output ({len(out)} chars)</summary><pre>{html.escape(out[:8000])}</pre></details></div>")
            elif e.get("type") == "step_finish":
                rows.append(f"<div class=s>step: {html.escape(json.dumps(p.get('tokens')))}</div>")
            elif e.get("type") == "error":
                rows.append(f"<div class=e><b>error</b><pre>{html.escape(json.dumps(e.get('error')))}</pre></div>")
    page = f"""<!doctype html><meta charset=utf-8><title>{html.escape(run.name)}</title>
<style>body{{font:14px system-ui;margin:16px;max-width:1000px}}pre{{white-space:pre-wrap;background:#f4f4f4;padding:8px}}
.c{{border-left:3px solid #3f51b5;padding-left:8px;margin:8px 0}}.t{{border-left:3px solid #009688;padding-left:8px}}
.s{{color:#777;font-size:12px}}.e{{border-left:3px solid #c62828;padding-left:8px}}
@media(prefers-color-scheme:dark){{body{{background:#111;color:#ddd}}pre{{background:#222}}}}</style>
<h1>{html.escape(run.name)}</h1>{''.join(rows) or '<p>No events.</p>'}"""
    (run / "transcript.html").write_text(page)


def lab_page(batch, brief_text, runs, spend):
    by_setup = {}
    for r in runs:
        by_setup.setdefault(r["setup"], []).append(r)
    cols = []
    for sid, rs in by_setup.items():
        cards = []
        for r in rs:
            m, c = r.get("meta") or {}, r.get("checks") or {}
            rel = r["dir"].name
            status = "rendered" if m.get("rendered") else "NOT rendered"
            errs = len(c.get("page_errors", [])) + len(c.get("console_errors", []))
            img = f'<a href="{rel}/screenshot.png"><img src="{rel}/screenshot.png" loading=lazy></a>' if (r["dir"] / "screenshot.png").exists() else "<div class=noimg>no screenshot</div>"
            tk, mc, ag, hs, orr = (m.get('tokens') or {}), (m.get('model_calls') or {}), (m.get('agent') or {}), (m.get('host') or {}), (m.get('openrouter') or {})
            shots = sorted((r["dir"] / "shots").glob("mode-*.png")) if (r["dir"] / "shots").exists() else []
            strip = "".join(f'<a href="{rel}/shots/{p.name}"><img class=mini title="{p.stem}" src="{rel}/shots/{p.name}" loading=lazy></a>' for p in shots)
            extra = []
            if c.get("check_version", 1) >= 2:
                clicks = c.get("clicks") or []
                extra.append(f"animated {c.get('animated')} · draws/frame {c.get('draw_calls_per_frame')} · tris/frame {c.get('primitives_per_frame'):,} · mode buttons {sum(1 for x in clicks if x.get('found'))}/{len(clicks)} · modes ok {c.get('modes_rendered')}" if c.get('primitives_per_frame') is not None else "")
            if orr:
                extra.append(f"OpenRouter: ${orr.get('cost_usd')} · providers {html.escape(json.dumps(orr.get('providers')))}")
            if hs.get("power_samples"):
                extra.append(f"energy {hs.get('energy_wh')} Wh · avg {hs.get('avg_watts')} W (CPU+GPU+ANE) · thermal {', '.join(hs.get('thermal_levels') or [])}")
            if mc:
                extra.append(f"calls {mc.get('model_calls')} · TTFT p50 {mc.get('ttft_ms_p50')} ms · truncated {mc.get('truncated')} · upstream errors {mc.get('upstream_errors')} · tool errors {ag.get('tool_errors')} · previews {ag.get('preview_calls')}")
            if m.get("concurrent_runs"):
                extra.append(f"shared engine with {len(m['concurrent_runs'])} other run(s)")
            cards.append(f"""<div class=card>{img}<div class=strip>{strip}</div>
<div class=meta><b class={'ok' if m.get('rendered') else 'bad'}>{status}</b> · {errs} error(s) · fps {c.get('fps', '–')}<br>
{html.escape(str(m.get('end_reason', r.get('error', '?'))))} · {m.get('tool_calls', '–')} tool calls · {tk.get('steps', '–')} steps<br>
tokens: generated {tk.get('generated', 0):,} (output {tk.get('output', 0):,} · reasoning {tk.get('reasoning', 0):,}) · input {tk.get('input', 0):,} + cached {tk.get('cache_read', 0):,}<br>
{'<br>'.join(e for e in extra if e)}<br>
<small>wall {m.get('wall_seconds', '–')} s (hardware-dependent)</small><br>
<a href="{rel}/transcript.html">transcript</a> · live: <code>bin/serve.py {html.escape(str(r['dir']))}</code></div></div>""")
        cols.append(f"<section><h2>{html.escape(sid)}</h2>{''.join(cards)}</section>")
    spend_txt = f"${spend:.4f}" if spend is not None else "unknown"
    page = f"""<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Prompt lab {html.escape(batch.name)}</title>
<style>body{{font:14px system-ui;margin:16px}}pre{{white-space:pre-wrap;background:#f4f4f4;padding:8px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}}
img{{width:100%;border:1px solid #ccc}}.card{{margin-bottom:16px}}.ok{{color:#2e7d32}}.bad{{color:#c62828}}
.strip{{display:flex;gap:4px;margin-top:4px}}.mini{{width:32%;border:1px solid #ccc}}.noimg{{height:180px;display:grid;place-items:center;background:#eee}}
@media(prefers-color-scheme:dark){{body{{background:#111;color:#ddd}}pre{{background:#222}}a{{color:#8ab4f8}}}}</style>
<h1>Prompt lab · {html.escape(batch.name)}</h1>
<details open><summary>Brief</summary><pre>{html.escape(brief_text)}</pre></details>
<p>Actual spend for this batch (OpenRouter key usage delta): {spend_txt}</p>
<div class=grid>{''.join(cols)}</div>"""
    (batch / "index.html").write_text(page)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("brief")
    ap.add_argument("--setups", default="or-ds1017-fast,or-glm53flash-fast,or-qwen27-fast")
    ap.add_argument("--samples", type=int, default=1)
    ap.add_argument("--yes", action="store_true")
    args = ap.parse_args()

    # Only used for the cost estimate and the spend measurement; setups on
    # other endpoints (CPA, the M3) run without it.
    key = os.environ.get("OPENROUTER_API_KEY")
    setup_files = [ROOT / "setups" / f"{s.strip()}.json" for s in args.setups.split(",")]
    setups = [json.loads(p.read_text()) for p in setup_files]
    total, lines = estimate(setups, args.samples) if key else (0.0, ["  (no OpenRouter key: no estimate)"])
    print(f"Estimated cost: ~${total:.2f} (rough; actual spend is measured)")
    print("\n".join(lines))
    if not args.yes and input("Start? [y/N] ").strip().lower() != "y":
        sys.exit("cancelled")

    brief = Path(args.brief)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    batch = ROOT / "lab" / f"{stamp}-{brief.stem}"
    batch.mkdir(parents=True)
    before = key_usage(key) if key else None

    def one(job):
        setup_file, sample = job
        proc = subprocess.run(
            [sys.executable, str(ROOT / "bin" / "run.py"), "--setup", str(setup_file),
             "--brief", str(brief), "--sample", str(sample), "--lab", "--out", str(batch)],
            text=True, capture_output=True)
        last = (proc.stdout.strip().splitlines() or ["{}"])[-1]
        try:
            res = json.loads(last)
        except ValueError:
            res = {}
        if "run" not in res:
            err = (proc.stderr.strip() or last)[-500:]
            print(f"  {setup_file.stem} s{sample}: FAILED before a run record: {err}", flush=True)
            return {"setup": setup_file.stem, "error": err, "dir": batch}
        run = Path(res["run"])
        transcript_html(run)
        out = {"setup": setup_file.stem, "dir": run}
        for name in ("meta", "checks"):
            f = run / f"{name}.json"
            out[name] = json.loads(f.read_text()) if f.exists() else None
        print(f"  {setup_file.stem} s{sample}: {res.get('end')} · rendered={res.get('rendered')} · {res.get('wall_seconds')} s", flush=True)
        return out

    jobs = [(f, s) for f in setup_files for s in range(1, args.samples + 1)]
    with ThreadPoolExecutor(max_workers=min(len(jobs), 6)) as pool:
        runs = list(pool.map(one, jobs))
    # OpenRouter's usage counter lags; wait up to two minutes for it to move.
    after = None
    for _ in range(12):
        after = key_usage(key) if key else None
        if before is None or after is None or after > before:
            break
        time.sleep(10)
    spend = (after - before) if before is not None and after is not None else None
    lab_page(batch, brief.read_text(), runs, spend)
    print(f"Spend: {'$%.4f' % spend if spend is not None else 'unknown'}")
    print(f"Lab page: {batch / 'index.html'}")


if __name__ == "__main__":
    main()
