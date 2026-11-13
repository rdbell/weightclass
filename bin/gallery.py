#!/usr/bin/env python3
"""Build the static gallery (GitHub Pages) from run directories.

  bin/gallery.py RUN_DIR... [--out docs]

Writes OUT/index.html (summary first, details on demand), OUT/data.json,
OUT/vendor/three (the pinned three.js, once), and per run OUT/runs/<id>/:
  scene/        the final workspace as the model left it, except that
                "./vendor/three/" is rewritten to the shared copy (the only
                change; recorded as scene_rewrite in data.json)
  shots/*.png   judged screenshots (default, modes, clicks)
  transcript.html, meta.json, checks.json
Scenes run in <iframe sandbox="allow-scripts"> (opaque origin: no access to
the gallery, cookies or storage). Full raw records stay in the lab tree.
"""
import argparse
import sys
import html
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "bin"))
import run as R  # noqa: E402
THREE = ROOT / "harness" / "vendor" / "three-0.187.0"
TEXT = {".html", ".htm", ".js", ".mjs", ".css", ".json", ".glsl", ".vert", ".frag", ".txt", ".md"}

MODEL = {"ds1017": "DeepSeek V4.1 Flash 1017", "glm53flash": "GLM-5.3-Flash",
         "qwen27": "Qwen3.8-27B", "qwenflash": "Qwen3.8-Flash-Next"}


def model_of(setup_id):
    for k, v in MODEL.items():
        if k in setup_id:
            return v
    return setup_id


def copy_scene(src, dst):
    rewrites = 0
    for f in src.rglob("*"):
        rel = f.relative_to(src)
        if not rel.parts or rel.parts[0] in ("vendor", ".preview") or f.is_dir():
            continue
        out = dst / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        if f.suffix.lower() in TEXT:
            text = f.read_text(errors="replace")
            depth = "../" * (len(rel.parts) - 1)
            new = text.replace("./vendor/three/", f"{depth}../../../vendor/three/")
            rewrites += text.count("./vendor/three/")
            out.write_text(new)
        else:
            shutil.copy2(f, out)
    return rewrites


def run_record(run, out):
    meta = json.loads((run / "meta.json").read_text())
    checks = json.loads((run / "checks.json").read_text()) if (run / "checks.json").exists() else {}
    bf = meta.get("backfill") or {}
    setup = meta["setup"]
    rid = run.name
    dst = out / "runs" / rid
    if dst.exists():
        shutil.rmtree(dst)
    rewrites = copy_scene(run / "workspace", dst / "scene")
    shots = []
    if (run / "screenshot.png").exists():
        (dst / "shots").mkdir(parents=True, exist_ok=True)
        shutil.copy2(run / "screenshot.png", dst / "shots" / "default.png")
        shots.append("default")
    for p in sorted((run / "shots").glob("*.png")) if (run / "shots").exists() else []:
        shutil.copy2(p, dst / "shots" / p.name)
        shots.append(p.stem)
    for name in ("transcript.html", "checks.json"):
        if (run / name).exists():
            shutil.copy2(run / name, dst / name)
    pub_meta = {k: v for k, v in meta.items() if k not in ("setup",)}
    # Private endpoints, hostnames and SSH targets are not published.
    pub_meta["setup"] = {k: v for k, v in setup.items()
                         if k not in ("api_key_env", "base_url", "host_header", "host")}
    pub_meta["concurrent_runs"] = [{k: v for k, v in c.items() if k != "endpoint"}
                                   for c in meta.get("concurrent_runs") or []]
    if setup.get("kind") != "local":
        pub_meta["setup"]["base_url"] = setup.get("base_url")
    (dst / "meta.json").write_text(json.dumps(pub_meta, indent=2))

    # Prefer totals over every model request (relay; includes sub-agents).
    raw = bf.get("tokens_raw") if (bf.get("tokens_raw") or {}).get("model_calls") is not None else None
    if raw is None and (meta.get("tokens") or {}).get("model_calls") is not None:
        raw = meta["tokens"]
    sess = meta.get("tokens_session") or (meta.get("tokens") if raw is None or "steps" in (meta.get("tokens") or {}) else {}) or {}
    tok = raw or sess
    reasoning, output = tok.get("reasoning", 0), tok.get("output", 0)
    methods = (raw or {}).get("reasoning_method") or ["reported"]
    tok_note = "reported" if methods == ["reported"] else "; ".join(methods)
    p = bf.get("prompt") or meta["prompt"]
    agent = meta.get("agent") or R.agent_summary(R.read_events(run / "record" / "events.jsonl"))
    host = meta.get("host") or {}
    orr = meta.get("openrouter") or {}
    mc = meta.get("model_calls") or {}
    local = setup.get("kind") == "local"
    cur = SETUPS.get(setup["id"], {})
    eng = setup.get("engine") or {}
    pack = cur.get("pack") or setup.get("pack") or {}
    return {
        "quant": cur.get("quant") or setup.get("quant"),
        "pack_label": cur.get("pack_label") or setup.get("pack_label"),
        "pack_link": bool(pack.get("repo")),
        "pack_extras": pack.get("extras"),
        "pack_revision": pack.get("revision"), "pack_bytes": pack.get("total_bytes"),
        "engine_settings": ", ".join(f"{k}={v}" for k, v in eng.items() if k not in ("name", "version")) or None,
        "request": json.dumps(setup.get("request_body") or {}, separators=(", ", ": ")),
        "model_id": setup.get("model_id") if not local else None,
        "id": rid, "prompt": p.get("id"), "prompt_title": (p.get("title") or "").removesuffix(" (open)"), "variant": p.get("variant"),
        "setup": setup["id"], "model": model_of(setup["id"]), "where": "local" if local else "hosted",
        "label": setup.get("label"),
        "pack": pack.get("repo"), "engine": (setup.get("engine") or {}).get("name"),
        "engine_version": (setup.get("engine") or {}).get("version"),
        "hardware": "M3 Ultra 60c / 256 GB" if local else None,
        "providers": sorted(set(mc.get("providers") or []) | set((orr.get("providers") or {}).keys())),
        "end": bf.get("end_reason") or meta.get("end_reason"),
        "steps": (raw or {}).get("model_calls") or sess.get("steps"),
        "session_steps": sess.get("steps"), "subagent_calls": agent.get("subagent_calls", 0),
        "token_source": "all model requests (relay)" if raw else "main session events (run predates the relay)",
        "tool_calls": meta.get("tool_calls"),
        "tool_errors": agent.get("tool_errors"),
        "generated": output + reasoning, "output": output, "reasoning": reasoning, "token_note": tok_note,
        "input": tok.get("input"), "cached": tok.get("cache_read"),
        "energy_wh": host.get("energy_wh"), "avg_watts": host.get("avg_watts"),
        "thermal": host.get("thermal_levels"),
        "cost_usd": orr.get("cost_usd"),
        "wall_seconds": meta.get("wall_seconds"), "concurrent": len(meta.get("concurrent_runs") or []),
        "decode_tps_p50": mc.get("decode_tps_p50"), "ttft_ms_p50": mc.get("ttft_ms_p50"),
        "checks": {k: checks.get(k) for k in ("check_version", "canvases", "fps", "draw_calls_per_frame",
                                              "primitives_per_frame", "animated", "page_errors",
                                              "console_errors", "missing_files", "blank")},
        "modes": [{"mode": m.get("mode"), "blank": m.get("blank"), "errors": len(m.get("page_errors") or []),
                   "diff": m.get("diff_vs_default")} for m in checks.get("modes") or []],
        "clicks": [{"mode": c.get("mode"), "found": c.get("found"), "diff": c.get("diff_vs_before")}
                   for c in checks.get("clicks") or []],
        "shots": shots, "scene_rewrite": f'"./vendor/three/" -> shared copy ({rewrites} occurrence(s))',
        "harness": {k: (meta.get("harness") or {}).get(k) for k in ("opencode", "playwright", "three", "image_id")},
        "started": meta.get("started"),
    }


TEMPLATE = ROOT / "site" / "template.html"
SETUPS = {json.loads(f.read_text())["id"]: json.loads(f.read_text()) for f in (ROOT / "setups").glob("*.json")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("runs", nargs="+")
    ap.add_argument("--out", default=str(ROOT / "docs"))
    args = ap.parse_args()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    vend = out / "vendor" / "three"
    if not vend.exists():
        shutil.copytree(THREE, vend)
    # Historical spec runs stay in the lab, outside the published gallery.
    selected = []
    for source in args.runs:
        source = Path(source).resolve()
        meta = json.loads((source / "meta.json").read_text())
        prompt = (meta.get("backfill") or {}).get("prompt") or meta["prompt"]
        if prompt.get("variant") == "open":
            selected.append(source)
    for old in (out / "runs").glob("*/meta.json"):
        meta = json.loads(old.read_text())
        prompt = (meta.get("backfill") or {}).get("prompt") or meta["prompt"]
        if prompt.get("variant") == "spec":
            shutil.rmtree(old.parent)
    data = [run_record(source, out) for source in selected]
    # Several samples of one setup on one prompt: number them by start time.
    groups = {}
    for d in sorted(data, key=lambda d: d.get("started") or ""):
        key = (d["prompt"], d["setup"])
        groups[key] = groups.get(key, 0) + 1
        d["run_no"] = groups[key]
    for d in data:
        d["runs_of_setup"] = groups[(d["prompt"], d["setup"])]
        # Retry policy: the latest attempt is the result; earlier ones stay
        # reachable from it.
        d["superseded"] = d["run_no"] < d["runs_of_setup"]
    prompts = {}
    for f in sorted((ROOT / "prompts").rglob("*.md")):
        text = f.read_text()
        meta = {}
        if text.startswith("---\n"):
            for line in text.split("\n---\n", 1)[0].splitlines()[1:]:
                k, _, v = line.partition(":")
                meta[k.strip()] = v.split("#", 1)[0].strip()
        if meta.get("id") in {d["prompt"] for d in data}:
            prompts[meta["id"]] = {"title": (meta.get("title") or "").removesuffix(" (open)"), "variant": meta.get("variant"),
                                   "mode_param": meta.get("mode_param"),
                                   "modes": [m.strip() for m in meta.get("modes", "").split(",") if m.strip()],
                                   "text": text.split("\n---\n", 1)[1].strip() if text.startswith("---\n") else text,
                                   "url": f"https://github.com/rdbell/weightclass/blob/main/{f.relative_to(ROOT)}"}
    order = sorted(prompts, key=lambda k: (prompts[k]["variant"] != "open", k))
    prompts = {k: prompts[k] for k in order}
    (out / "data.json").write_text(json.dumps(data, indent=1))
    import site_pages as SP
    js = lambda o: json.dumps(o).replace("</", "<\\/")
    tpl = TEMPLATE.read_text().replace("__DATA__", js(data)).replace("__PROMPTS__", js(prompts)).replace("__BASE__", "../../")
    for sub in ("tasks", "setups", "assets"):
        if (out / sub).exists():
            shutil.rmtree(out / sub)
    (out / "assets").mkdir()
    (out / "assets" / "site.css").write_text(SP.CSS)
    for pid in prompts:
        (out / "tasks" / pid).mkdir(parents=True)
        (out / "tasks" / pid / "index.html").write_text(tpl.replace("__PROMPT__", pid))
    for sid in sorted({d["setup"] for d in data}):
        (out / "setups" / sid).mkdir(parents=True)
        (out / "setups" / sid / "index.html").write_text(SP.build_setup(sid, data, prompts))
    (out / "index.html").write_text(SP.build_home(data, prompts))
    (out / ".nojekyll").write_text("")
    print(f"{out}: {len(data)} runs, prompts {list(prompts)}")


if __name__ == "__main__":
    main()
