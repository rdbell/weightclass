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

    tok = meta.get("tokens") or {}
    raw = bf.get("tokens_raw")
    if raw and not tok.get("reasoning") and raw.get("reasoning"):
        reasoning, output, tok_note = raw["reasoning"], raw["output"], "; ".join(raw["method"])
    else:
        reasoning, output, tok_note = tok.get("reasoning", 0), tok.get("output", 0), "reported"
    p = bf.get("prompt") or meta["prompt"]
    agent = meta.get("agent") or R.agent_summary(R.read_events(run / "record" / "events.jsonl"))
    host = meta.get("host") or {}
    orr = meta.get("openrouter") or {}
    mc = meta.get("model_calls") or {}
    local = setup.get("kind") == "local"
    return {
        "id": rid, "prompt": p.get("id"), "prompt_title": p.get("title"), "variant": p.get("variant"),
        "setup": setup["id"], "model": model_of(setup["id"]), "where": "local" if local else "hosted",
        "label": setup.get("label"),
        "pack": (setup.get("pack") or {}).get("repo"), "engine": (setup.get("engine") or {}).get("name"),
        "engine_version": (setup.get("engine") or {}).get("version"),
        "hardware": "M3 Ultra 60c / 256 GB" if local else None,
        "providers": sorted(set(mc.get("providers") or []) | set((orr.get("providers") or {}).keys())),
        "end": bf.get("end_reason") or meta.get("end_reason"),
        "steps": tok.get("steps"), "tool_calls": meta.get("tool_calls"),
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


PAGE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Weightclass gallery</title>
<style>
:root{--bg:#fbfaf7;--fg:#1d1d1f;--mut:#6b6b70;--line:#e3e1db;--card:#fff;--ok:#1f7a3a;--bad:#b3261e;--warn:#9a6700;--acc:#2f5bd3}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121214;--fg:#ececee;--mut:#9a9aa2;--line:#2b2b31;--card:#1a1a1e;--ok:#5cc27a;--bad:#ff7b72;--warn:#e3b341;--acc:#8ab4f8}}
:root[data-theme="dark"]{--bg:#121214;--fg:#ececee;--mut:#9a9aa2;--line:#2b2b31;--card:#1a1a1e;--ok:#5cc27a;--bad:#ff7b72;--warn:#e3b341;--acc:#8ab4f8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px 64px}h1{font-size:28px;margin:0 0 4px}h2{font-size:20px;margin:32px 0 8px}
.sub{color:var(--mut);margin:0 0 16px}a{color:var(--acc)}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.tabs button{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:999px;padding:6px 14px;cursor:pointer;font:inherit}
.tabs button[aria-pressed=true]{background:var(--fg);color:var(--bg)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.frame{position:relative;aspect-ratio:16/10;background:#000}.frame img,.frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0;object-fit:cover}
.frame .live{position:absolute;left:8px;bottom:8px;font-size:12px;background:rgba(0,0,0,.6);color:#fff;border-radius:6px;padding:2px 8px}
.body{padding:12px 14px;display:flex;flex-direction:column;gap:6px}.title{font-weight:600}.meta{color:var(--mut);font-size:13px}
.badge{display:inline-block;font-size:12px;border-radius:6px;padding:1px 7px;border:1px solid var(--line)}.badge.warn{border-color:currentColor}.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:4px 10px;font-size:13px}.stats b{display:block;font-size:15px}
.modes{display:flex;gap:6px}.modes button{flex:1;border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:6px;padding:3px 0;cursor:pointer;font:inherit;font-size:13px}
.modes button[aria-pressed=true]{background:var(--acc);color:#fff;border-color:var(--acc)}
details{border-top:1px solid var(--line);padding:8px 14px}summary{cursor:pointer;color:var(--mut);font-size:13px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;font-size:13px;margin:8px 0}dt{color:var(--mut)}dd{margin:0;overflow-wrap:anywhere}
.thumbs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.thumbs img{width:100%;border-radius:4px;border:1px solid var(--line)}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}th{color:var(--mut);font-weight:500}
.tablewrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:12px}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.note{color:var(--mut);font-size:13px}
</style></head><body><main>
<h1>Weightclass</h1>
<p class="sub">Open-weight models and their local packs, given one task each and no follow-up, in <a href="https://opencode.ai">OpenCode</a>. Early proof of concept: no votes yet, one sample per setup. <a href="https://github.com/rdbell/weightclass">Code, method and spec</a>.</p>
<div class="tabs" id="tabs"></div>
<p class="note" id="pdesc"></p>
<div class="tablewrap"><table id="summary"></table></div>
<p class="note">Generated tokens = output + reasoning. Energy is CPU+GPU+ANE from powermetrics on the M3 Ultra (local runs; not wall power). Wall time depends on hardware and on the other run sharing the engine, so it is shown, not ranked.</p>
<h2>Scenes</h2>
<p class="note">Scenes are live: each runs the model's own page in a sandboxed frame when it scrolls into view (at most four at once). The picture is a judged screenshot until then.</p>
<div class="grid" id="grid"></div>
</main>
<script>
const DATA = __DATA__;
const PROMPTS = __PROMPTS__;
const fmt = n => n == null ? "–" : n >= 1000 ? (n/1000).toFixed(1) + "K" : String(n);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
// Facts, not a verdict: how the run ended, and what the judged page did.
const statusOf = r => [String(r.end).startsWith("step cap") || String(r.end).startsWith("guard") ? "warn" : "", r.end];
const factsOf = r => { const c = r.checks || {}; const m = (c.missing_files||[]).length, e = (c.page_errors||[]).length;
  return `${c.canvases ?? "?"} canvas · ${m} missing file${m===1?"":"s"} · ${e} page error${e===1?"":"s"}`; };
let current = Object.keys(PROMPTS)[0];
try { const s = localStorage.getItem("wc-prompt"); if (s && PROMPTS[s]) current = s; } catch (e) {}
const tabs = document.getElementById("tabs");
function renderTabs(){
  tabs.innerHTML = Object.entries(PROMPTS).map(([id,p]) => `<button aria-pressed="${id===current}" data-id="${id}">${esc(p.title)}</button>`).join("");
  tabs.querySelectorAll("button").forEach(b => b.onclick = () => { current = b.dataset.id; try{localStorage.setItem("wc-prompt", current)}catch(e){}; render(); });
}
const live = new Set(); const MAX_LIVE = 4;
const io = new IntersectionObserver(es => { for (const e of es) { const f = e.target; if (e.isIntersecting) activate(f); else deactivate(f); } }, {rootMargin: "100px"});
function activate(f){
  if (f.querySelector("iframe")) return;
  if (live.size >= MAX_LIVE) { const old = live.values().next().value; deactivate(old); }
  const ifr = document.createElement("iframe");
  ifr.setAttribute("sandbox", "allow-scripts"); ifr.setAttribute("loading", "lazy");
  ifr.title = "Live scene"; ifr.src = f.dataset.src + (f.dataset.mode ? "?" + f.dataset.param + "=" + f.dataset.mode : "");
  f.appendChild(ifr); live.add(f);
}
function deactivate(f){ const i = f.querySelector("iframe"); if (i) i.remove(); live.delete(f); }
function render(){
  renderTabs();
  const p = PROMPTS[current]; document.getElementById("pdesc").innerHTML = `${esc(p.variant === "spec" ? "Spec variant: a hard specification, measuring instruction following; results should look alike." : "Open variant: outcomes, not steps; the model decides the scene.")} <a href="${esc(p.url)}">Prompt</a>.`;
  const rows = DATA.filter(r => r.prompt === current).sort((a,b) => a.model.localeCompare(b.model) || a.where.localeCompare(b.where));
  document.getElementById("summary").innerHTML = `<thead><tr><th>Model</th><th>Where</th><th>Run ended</th><th>Judged page</th><th class=num>Generated</th><th class=num>Output</th><th class=num>Reasoning</th><th class=num>Steps</th><th class=num>Tool errors</th><th class=num>Energy</th><th class=num>Cost</th><th class=num>Wall</th></tr></thead><tbody>` +
    rows.map(r => { const [cls, txt] = statusOf(r); return `<tr><td><a href="#${esc(r.id)}">${esc(r.model)}</a></td><td>${esc(r.where === "local" ? (r.engine + " · M3 Ultra") : "OpenRouter")}</td><td><span class="badge ${cls}">${esc(txt)}</span></td><td>${esc(factsOf(r))}</td><td class=num>${fmt(r.generated)}</td><td class=num>${fmt(r.output)}</td><td class=num>${fmt(r.reasoning)}${r.token_note !== "reported" ? "*" : ""}</td><td class=num>${r.steps ?? "–"}</td><td class=num>${r.tool_errors ?? "–"}</td><td class=num>${r.energy_wh != null ? r.energy_wh + " Wh" : "–"}</td><td class=num>${r.cost_usd != null ? "$" + r.cost_usd.toFixed(3) : "–"}</td><td class=num>${r.wall_seconds ? Math.round(r.wall_seconds/60) + " min" : "–"}</td></tr>`; }).join("") +
    `</tbody>`;
  if (rows.some(r => r.token_note !== "reported")) document.getElementById("summary").insertAdjacentHTML("beforeend", `<caption class="note" style="caption-side:bottom;text-align:left;padding:6px 8px">* estimated from the share of reasoning characters in the raw stream (the engine reports one combined count).</caption>`);
  const grid = document.getElementById("grid"); live.forEach(deactivate); grid.innerHTML = "";
  for (const r of rows) {
    const [cls, txt] = statusOf(r);
    const base = `runs/${r.id}/`;
    const modes = r.modes.map(m => m.mode);
    const card = document.createElement("article"); card.className = "card"; card.id = r.id;
    card.innerHTML = `<div class="frame" data-src="${base}scene/index.html" data-param="${esc(p.mode_param || "")}"><img alt="Judged screenshot of ${esc(r.model)}" src="${base}shots/default.png" loading="lazy"><span class="live">live when visible</span></div>
<div class="body"><div class="title">${esc(r.model)} <span class="meta">· ${esc(r.where === "local" ? r.engine + " " + (r.engine_version||"") + " · M3 Ultra" : "OpenRouter" + (r.providers.length ? " · " + r.providers.join(", ") : ""))}</span></div>
<div><span class="badge ${cls}">${esc(txt)}</span> <span class="meta">${esc(factsOf(r))}</span></div>
${modes.length && p.mode_param ? `<div class="modes">${modes.map(m => `<button data-m="${esc(m)}" aria-pressed="false">${esc(m)}</button>`).join("")}</div>` : ""}
<div class="stats"><div>Generated<b>${fmt(r.generated)}</b></div><div>Reasoning<b>${fmt(r.reasoning)}${r.token_note !== "reported" ? "*" : ""}</b></div><div>Steps<b>${r.steps ?? "–"}</b></div>
<div>Energy<b>${r.energy_wh != null ? r.energy_wh + " Wh" : "–"}</b></div><div>Tool errors<b>${r.tool_errors ?? "–"}</b></div><div>Cost<b>${r.cost_usd != null ? "$" + r.cost_usd.toFixed(3) : "–"}</b></div></div></div>
<details><summary>Screenshots of each mode</summary><div class="thumbs">${r.shots.filter(s => s.startsWith("mode-") || s === "default").map(s => `<a href="${base}shots/${s}.png"><img loading="lazy" alt="${esc(s)}" src="${base}shots/${s}.png"></a>`).join("")}</div></details>
<details><summary>Run details</summary><dl>
<dt>Setup</dt><dd>${esc(r.label)}</dd>${r.pack ? `<dt>Pack</dt><dd>${esc(r.pack)}</dd>` : ""}${r.hardware ? `<dt>Hardware</dt><dd>${esc(r.hardware)}</dd>` : ""}
<dt>Tokens</dt><dd>output ${fmt(r.output)} · reasoning ${fmt(r.reasoning)} (${esc(r.token_note)}) · fresh input ${fmt(r.input)} · cached input ${fmt(r.cached)}</dd>
<dt>Tool calls</dt><dd>${r.tool_calls ?? "–"} (${r.tool_errors ?? "–"} errors)</dd>
<dt>Wall time</dt><dd>${r.wall_seconds ? Math.round(r.wall_seconds/60) + " min" : "–"}${r.concurrent ? " (engine shared with " + r.concurrent + " other run)" : ""}</dd>
${r.decode_tps_p50 ? `<dt>Decode p50</dt><dd>${r.decode_tps_p50} tok/s · TTFT p50 ${r.ttft_ms_p50} ms</dd>` : ""}
${r.energy_wh != null ? `<dt>Power</dt><dd>${r.energy_wh} Wh · avg ${r.avg_watts} W · thermal ${esc((r.thermal||[]).join(", "))}</dd>` : ""}
<dt>Render check</dt><dd>v${r.checks.check_version} · canvases ${r.checks.canvases ?? "–"} · fps ${r.checks.fps ?? "–"} (software) · draws/frame ${r.checks.draw_calls_per_frame ?? "–"} · triangles/frame ${fmt(r.checks.primitives_per_frame)} · animated ${r.checks.animated ?? "–"}</dd>
<dt>Errors</dt><dd>page ${(r.checks.page_errors||[]).length} · console ${(r.checks.console_errors||[]).length} · missing files ${esc((r.checks.missing_files||[]).join(", ") || "none")}</dd>
<dt>Mode buttons</dt><dd>${r.clicks.map(c => esc(c.mode) + (c.found ? " ✓" : " ✗")).join(" · ") || "–"}</dd>
<dt>Harness</dt><dd>OpenCode ${esc(r.harness.opencode)} · Playwright ${esc(r.harness.playwright)} · three.js ${esc(r.harness.three)}</dd>
<dt>Scene copy</dt><dd>${esc(r.scene_rewrite)}</dd>
<dt>Files</dt><dd><a href="${base}transcript.html">transcript</a> · <a href="${base}meta.json">meta.json</a> · <a href="${base}checks.json">checks.json</a> · <a href="${base}scene/index.html" target="_blank" rel="noopener">open scene</a></dd>
</dl></details>`;
    grid.appendChild(card);
    const frame = card.querySelector(".frame"); io.observe(frame);
    card.querySelectorAll(".modes button").forEach(b => b.onclick = () => {
      card.querySelectorAll(".modes button").forEach(x => x.setAttribute("aria-pressed", x === b)); frame.dataset.mode = b.dataset.m;
      const img = frame.querySelector("img"); if (r.shots.includes("mode-" + b.dataset.m)) img.src = base + "shots/mode-" + b.dataset.m + ".png";
      deactivate(frame); activate(frame);
    });
  }
}
render();
</script></body></html>
"""


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
    data = [run_record(Path(r).resolve(), out) for r in args.runs]
    prompts = {}
    for f in sorted((ROOT / "prompts").rglob("*.md")):
        text = f.read_text()
        meta = {}
        if text.startswith("---\n"):
            for line in text.split("\n---\n", 1)[0].splitlines()[1:]:
                k, _, v = line.partition(":")
                meta[k.strip()] = v.split("#", 1)[0].strip()
        if meta.get("id") in {d["prompt"] for d in data}:
            prompts[meta["id"]] = {"title": meta.get("title"), "variant": meta.get("variant"),
                                   "mode_param": meta.get("mode_param"),
                                   "url": f"https://github.com/rdbell/weightclass/blob/main/{f.relative_to(ROOT)}"}
    order = sorted(prompts, key=lambda k: (prompts[k]["variant"] != "open", k))
    prompts = {k: prompts[k] for k in order}
    (out / "data.json").write_text(json.dumps(data, indent=1))
    page = PAGE.replace("__DATA__", json.dumps(data)).replace("__PROMPTS__", json.dumps(prompts))
    (out / "index.html").write_text(page)
    (out / ".nojekyll").write_text("")
    print(f"{out}: {len(data)} runs, prompts {list(prompts)}")


if __name__ == "__main__":
    main()
