"""Static pages around the task viewer: home (tasks + results matrix) and
one page per setup. Plain HTML generated from the gallery's run records;
the home page has a few lines of script for its filters."""
import html
import json

REPO = "https://github.com/rdbell/weightclass"
SUITE = "3D scenes"   # the only suite so far; a prompt may set `suite:` later

CSS = """
:root{--bg:#f6f5f2;--panel:#fff;--ink:#17171a;--mut:#64646b;--faint:#8d8d94;--line:#e2e0da;--soft:#efede8;
--acc:#2b59c3;--acc-ink:#fff;--warn:#9a5b00;--warn-bg:#fff4e0;--bad:#b3261e;--bad-bg:#fdecea;--chip:#eceae4;--stage:#0d0d10;--r:14px;
--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f0f12;--panel:#17171b;--ink:#ececf0;--mut:#a0a0a8;--faint:#76767e;
--line:#2a2a30;--soft:#1f1f24;--acc:#7fa6ff;--acc-ink:#0f0f12;--warn:#f0b35a;--warn-bg:#2b2112;--bad:#ff8a80;--bad-bg:#2c1615;--chip:#24242a;--stage:#050506}}
:root[data-theme="dark"]{--bg:#0f0f12;--panel:#17171b;--ink:#ececf0;--mut:#a0a0a8;--faint:#76767e;--line:#2a2a30;--soft:#1f1f24;
--acc:#7fa6ff;--acc-ink:#0f0f12;--warn:#f0b35a;--warn-bg:#2b2112;--bad:#ff8a80;--bad-bg:#2c1615;--chip:#24242a;--stage:#050506}
*{box-sizing:border-box}html,body{margin:0}[hidden]{display:none!important}
body{background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--acc)}.wrap{max-width:1440px;margin:0 auto;padding:0 20px}
header.top{border-bottom:1px solid var(--line);background:var(--panel)}
header.top .wrap{display:flex;align-items:center;gap:22px;min-height:60px;flex-wrap:wrap;padding-top:10px;padding-bottom:10px}
.brand{font-weight:700;font-size:18px;color:var(--ink);text-decoration:none}
nav.main{display:flex;gap:4px;flex-wrap:wrap}nav.main a{color:var(--mut);text-decoration:none;padding:6px 10px;border-radius:8px}
nav.main a:hover,nav.main a[aria-current="page"]{background:var(--soft);color:var(--ink)}.spacer{flex:1}
h1{font-size:30px;letter-spacing:-.02em;margin:28px 0 6px;line-height:1.2}h2{font-size:20px;margin:36px 0 4px}
.lede{color:var(--mut);max-width:820px;margin:0 0 8px}.sub{color:var(--mut);font-size:14px;margin:0 0 14px}
.crumbs{font-size:13px;color:var(--mut);margin-top:18px}.crumbs a{color:var(--mut)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;text-decoration:none;color:var(--ink);display:block}
.card:hover{border-color:var(--faint)}
.mosaic{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:var(--stage);aspect-ratio:16/10}
.mosaic img{width:100%;height:100%;object-fit:cover;display:block}.mosaic.one{grid-template-columns:1fr}
.card .b{padding:12px 14px}.card .t{font-weight:650;font-size:16px}.card .d{color:var(--mut);font-size:13px;margin-top:2px}
.chip{display:inline-block;background:var(--chip);border-radius:7px;padding:2px 9px;font-size:13px;white-space:nowrap}
.chip.quant{background:var(--acc);color:var(--acc-ink);font-weight:600}.chip.hosted{background:transparent;border:1px dashed var(--faint);color:var(--mut)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.filters{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}
.seg{display:inline-flex;background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:3px;gap:2px}
.seg button{border:0;background:transparent;padding:5px 12px;border-radius:7px;cursor:pointer;color:var(--mut);font:inherit}
.seg button[aria-pressed="true"]{background:var(--panel);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.filters select,.filters input{font:inherit;font-size:14px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:6px 9px}
.tablewrap{overflow-x:auto;background:var(--panel);border:1px solid var(--line);border-radius:var(--r)}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{color:var(--mut);font-weight:500;white-space:nowrap}tr:last-child td{border-bottom:0}td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.setupcell a{font-weight:650;color:var(--ink);text-decoration:none}.setupcell a:hover{text-decoration:underline}
.setupcell .q{font-size:13px;margin-top:2px}.setupcell .w{font-size:12px;color:var(--mut)}
.cell{display:block;width:150px;text-decoration:none;color:var(--ink)}
.cell img{width:150px;aspect-ratio:16/10;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block;background:var(--stage)}
.cell span{display:block;font-size:12px;color:var(--mut);margin-top:3px;font-variant-numeric:tabular-nums}
.cell .bad{color:var(--bad)}.cell .warn{color:var(--warn)}.none{color:var(--faint)}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin:14px 0}
.stat{background:var(--soft);border-radius:10px;padding:8px 10px}.stat span{display:block;font-size:12px;color:var(--mut)}.stat b{font-size:18px;font-variant-numeric:tabular-nums}
dl.kv{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:6px 16px;margin:0;font-size:14px}dl.kv dt{color:var(--mut)}dl.kv dd{margin:0;overflow-wrap:anywhere}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:16px 18px}
.thumb{width:132px;aspect-ratio:16/10;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block;background:var(--stage)}
.mono{font-family:var(--mono);font-size:13px}.flag{font-size:12px;border-radius:6px;padding:1px 8px}.flag.bad{background:var(--bad-bg);color:var(--bad)}.flag.warn{background:var(--warn-bg);color:var(--warn)}
tr.old td{opacity:.62}
footer{color:var(--faint);font-size:13px;padding:18px 0 36px;margin-top:40px;border-top:1px solid var(--line)}
@media (max-width:700px){h1{font-size:24px}.cell,.cell img{width:120px}}
"""

esc = lambda s: html.escape(str(s if s is not None else ""))


def k(n):
    if n is None:
        return "–"
    return f"{n / 1e6:.2f}M" if n >= 1e6 else f"{n / 1000:.1f}K" if n >= 1000 else str(n)


def mins(s):
    if not s:
        return "–"
    return f"{int(s // 3600)} h {round(s % 3600 / 60)} min" if s >= 3600 else f"{round(s / 60)} min"


def failed(r):
    c = r.get("checks") or {}
    return not c.get("canvases") or bool(c.get("missing_files")) or bool(c.get("page_errors"))


def stopped(r):
    e = str(r.get("end") or "")
    return e.startswith("step cap") or e.startswith("guard")


def page_facts(r):
    c = r.get("checks") or {}
    m, e = len(c.get("missing_files") or []), len(c.get("page_errors") or [])
    return f"{c.get('canvases') or 0} canvas · {m} missing file{'' if m == 1 else 's'} · {e} page error{'' if e == 1 else 's'}"


def where(r):
    if r["where"] == "local":
        return f"{r['engine']} {r.get('engine_version') or ''} · M3 Ultra".replace("  ", " ")
    return "OpenRouter" + (" · " + ", ".join(r["providers"]) if r.get("providers") else "")


def head(title, base, current, desc):
    nav = [("Tasks", f"{base}#tasks", "tasks"), ("Results", f"{base}#results", "results")]
    links = "".join(f'<a href="{u}"{" aria-current=page" if key == current else ""}>{t}</a>' for t, u, key in nav)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="stylesheet" href="{base}assets/site.css"></head><body>
<header class="top"><div class="wrap"><a class="brand" href="{base}">Weightclass</a><nav class="main">{links}</nav><div class="spacer"></div>
<nav class="main"><a href="{REPO}">Method &amp; code</a></nav></div></header><main class="wrap">"""


FOOT = f"""</main><footer><div class="wrap">Open-weight models and their local packs, one task each, no follow-up, in OpenCode.
One result per setup and task so far; no votes yet. <a href="{REPO}">Source, spec and run format</a>.</div></footer></body></html>"""


def setup_chips(r, base=""):
    if r["where"] == "local":
        return f'<span class="chip quant">{esc(r["quant"])}</span><span class="chip">{esc(r["pack_label"])}</span><span class="chip">{esc(where(r))}</span>'
    return f'<span class="chip hosted">Hosted · provider-served</span><span class="chip">OpenRouter</span>'


def latest(data):
    return [r for r in data if not r.get("superseded")]


def build_home(data, prompts):
    res = latest(data)
    cards = []
    for pid, p in prompts.items():
        rs = [r for r in res if r["prompt"] == pid]
        shots = [r for r in rs if not failed(r)][:4]
        if len(shots) == 3:
            shots = shots[:2]
        mosaic = "".join(f'<img loading="lazy" alt="" src="runs/{r["id"]}/shots/default.png">' for r in shots)
        kind = "The model decides the scene"
        cards.append(f"""<a class="card" href="tasks/{pid}/"><div class="mosaic{' one' if len(shots) < 2 else ''}"{' style="aspect-ratio:32/10"' if len(shots) == 2 else ''}>{mosaic}</div>
<div class="b"><div class="t">{esc(p['title'])}</div><div class="d">{kind}</div><div class="d">{len(rs)} results · {len({r['model'] for r in rs})} models</div></div></a>""")

    setups = {}
    for r in sorted(res, key=lambda r: (r["where"] != "local", r["model"])):
        setups.setdefault(r["setup"], r)
    rows = []
    for sid, s in setups.items():
        cells = []
        for pid in prompts:
            r = next((x for x in res if x["setup"] == sid and x["prompt"] == pid), None)
            if not r:
                cells.append('<td><span class="none">not run</span></td>')
                continue
            note = '<span class="bad">no scene</span>' if failed(r) else (f'<span class="warn">{esc(r["end"])}</span>' if stopped(r) else "")
            att = f'<span>attempt {r["run_no"]} of {r["runs_of_setup"]}</span>' if r["runs_of_setup"] > 1 else ""
            en = f' · {r["energy_wh"]} Wh' if r.get("energy_wh") is not None else ""
            cells.append(f'<td><a class="cell" href="tasks/{pid}/#a={r["id"]}"><img loading="lazy" alt="{esc(r["model"])} on {esc(prompts[pid]["title"])}" '
                         f'src="runs/{r["id"]}/shots/default.png"><span>{k(r["generated"])} tokens{en}</span>{att}{note}</a></td>')
        q = f'<b>{esc(s["quant"])}</b> · {esc(s["pack"] or "")}' if s["where"] == "local" else "Hosted · provider-served"
        rows.append(f"""<tr data-where="{s['where']}" data-model="{esc(s['model'])}" data-text="{esc((s['model'] + ' ' + str(s.get('quant')) + ' ' + str(s.get('pack')) + ' ' + str(s.get('engine'))).lower())}">
<td class="setupcell"><a href="setups/{sid}/">{esc(s['model'])}</a><div class="q">{q}</div><div class="w">{esc(where(s) if s['where'] == 'local' else 'OpenRouter')}</div></td>{''.join(cells)}</tr>""")
    models = sorted({s["model"] for s in setups.values()})
    th = "".join(f'<th><a href="tasks/{pid}/">{esc(p["title"])}</a></th>' for pid, p in prompts.items())
    return head("Weightclass", "", "tasks", "Open-weight models and their local packs, given one task and no follow-up in OpenCode.") + f"""
<h1>Open-weight models, one prompt, no follow-up</h1>
<p class="lede">Each model, in a specific pack and quant on a specific engine, gets one prompt in OpenCode and works until it decides it is done.
No follow-up turns, no time limit. We publish what it made, live, with every token, model call and watt-hour. A failed attempt may be retried; every attempt stays listed.</p>
<p class="sub">Early proof of concept: {len(res)} results from {len(setups)} setups on {len(prompts)} tasks. One result per setup and task; no votes or rankings yet.</p>
<h2 id="tasks">Tasks · {SUITE}</h2><p class="sub">Pick a task to watch the results live and compare them side by side.</p>
<div class="cards">{''.join(cards)}</div>
<h2 id="results">Results by setup</h2><p class="sub">A setup is a model in one pack and quant on one engine. Click a result to open it, or a setup for everything it has run.</p>
<div class="filters"><div class="seg" id="fWhere"{'' if len({x['where'] for x in setups.values()}) > 1 else ' hidden'}><button data-v="" aria-pressed="true">All</button><button data-v="local" aria-pressed="false">Local</button><button data-v="hosted" aria-pressed="false">Hosted</button></div>
<select id="fModel" aria-label="Model"><option value="">All models</option>{''.join(f'<option>{esc(m)}</option>' for m in models)}</select>
<input id="fText" type="search" placeholder="Filter by quant, pack or engine" aria-label="Filter"></div>
<div class="tablewrap"><table><thead><tr><th>Setup</th>{th}</tr></thead><tbody id="rows">{''.join(rows)}</tbody></table></div>
<p class="sub" style="margin-top:10px">Tokens are generated tokens (output + reasoning). Energy is CPU+GPU+ANE on the M3 Ultra, not wall power.</p>
<script>
// Old single-page links (#p=task&a=run) go to the task page.
(function(){{const h=new URLSearchParams(location.hash.slice(1));const p=h.get("p");if(p){{h.delete("p");location.replace("tasks/"+encodeURIComponent(p)+"/#"+h.toString());}}}})();
const F={{where:"",model:"",text:""}};
function apply(){{document.querySelectorAll("#rows tr").forEach(tr=>{{tr.hidden=!((!F.where||tr.dataset.where===F.where)&&(!F.model||tr.dataset.model===F.model)&&(!F.text||tr.dataset.text.includes(F.text)));}});}}
document.querySelectorAll("#fWhere button").forEach(b=>b.onclick=()=>{{F.where=b.dataset.v;document.querySelectorAll("#fWhere button").forEach(x=>x.setAttribute("aria-pressed",x===b));apply();}});
document.getElementById("fModel").onchange=e=>{{F.model=e.target.value;apply();}};
document.getElementById("fText").oninput=e=>{{F.text=e.target.value.trim().toLowerCase();apply();}};
</script>""" + FOOT


def build_setup(sid, data, prompts):
    runs = sorted([r for r in data if r["setup"] == sid], key=lambda r: (list(prompts).index(r["prompt"]), -r["run_no"]))
    s = next(r for r in runs if not r.get("superseded"))
    res = [r for r in runs if not r.get("superseded")]
    ok = sum(1 for r in res if not failed(r))
    energy = [r["energy_wh"] for r in runs if r.get("energy_wh") is not None]
    rows = []
    for r in runs:
        flag = '<span class="flag bad">no scene</span>' if failed(r) else (f'<span class="flag warn">{esc(r["end"])}</span>' if stopped(r) else esc(r["end"]))
        att = f'attempt {r["run_no"]} of {r["runs_of_setup"]}' + ("" if r.get("superseded") else " · result") if r["runs_of_setup"] > 1 else "1 of 1"
        rows.append(f"""<tr class="{'old' if r.get('superseded') else ''}"><td><a href="../../tasks/{r['prompt']}/#a={r['id']}"><img class="thumb" loading="lazy" alt="" src="../../runs/{r['id']}/shots/default.png"></a></td>
<td><a href="../../tasks/{r['prompt']}/#a={r['id']}"><b>{esc(prompts[r['prompt']]['title'])}</b></a><br><span style="color:var(--mut);font-size:13px">{att}</span></td>
<td>{flag}<br><span style="color:var(--mut);font-size:13px">{esc(page_facts(r))}</span></td>
<td class="num">{k(r['generated'])}</td><td class="num">{k(r['reasoning'])}{'*' if r['token_note'] != 'reported' else ''}</td><td class="num">{r.get('steps') or '–'}</td>
<td class="num">{r.get('tool_errors') if r.get('tool_errors') is not None else '–'}</td><td class="num">{str(r['energy_wh']) + ' Wh' if r.get('energy_wh') is not None else '–'}</td><td class="num">{mins(r.get('wall_seconds'))}</td></tr>""")
    local = s["where"] == "local"
    pack = (f'<a href="https://huggingface.co/{esc(s["pack"])}">{esc(s["pack"])}</a> · ' if s.get("pack") and s.get("pack_link") else "") + esc(s["pack_label"])
    kv = [("Model", esc(s["model"])), ("Quant", esc(s["quant"] or "Provider-served; precision not recorded")), ("Pack", pack)]
    if s.get("pack_extras"):
        kv.append(("Also loaded", " · ".join(esc(x) for x in s["pack_extras"])))
    if s.get("pack_revision"):
        kv.append(("Revision", f'<span class="mono">{esc(s["pack_revision"])}</span>'))
    if s.get("pack_bytes"):
        kv.append(("Size on disk", f"{s['pack_bytes'] / 1e9:.1f} GB"))
    kv.append(("Engine", esc(f"{s['engine']} {s.get('engine_version') or ''}") if local else "OpenRouter (provider chosen per request)"))
    if s.get("engine_settings"):
        kv.append(("Engine settings", f'<span class="mono">{esc(s["engine_settings"])}</span>'))
    if s.get("hardware"):
        kv.append(("Hardware", esc(s["hardware"])))
    kv.append(("Request", f'<span class="mono">{esc(s["request"])}</span>'))
    title = f"{s['model']} · {s['quant'] if local else 'hosted'}"
    return head(f"{title} · Weightclass", "../../", "results", f"{title}: every task this setup has run on Weightclass.") + f"""
<div class="crumbs"><a href="../../">Weightclass</a> / <a href="../../#results">Setups</a></div>
<h1>{esc(s['model'])}</h1><div class="chips">{setup_chips(s)}</div>
<div class="stats"><div class="stat"><span>Tasks run</span><b>{len(res)}</b></div><div class="stat"><span>Working results</span><b>{ok} of {len(res)}</b></div>
<div class="stat"><span>Attempts</span><b>{len(runs)}</b></div><div class="stat"><span>Generated tokens</span><b>{k(sum(r['generated'] or 0 for r in runs))}</b></div>
{f'<div class="stat"><span>Energy</span><b>{sum(energy):.0f} Wh</b></div>' if energy else ''}</div>
<h2>Results</h2><p class="sub">Every attempt, newest first per task. Faded rows are earlier attempts that were retried.</p>
<div class="tablewrap"><table><thead><tr><th></th><th>Task</th><th>Run ended · judged page</th><th>Generated</th><th>Reasoning</th><th>Model calls</th><th>Tool errors</th><th>Energy</th><th>Wall</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table></div>
<p class="sub" style="margin-top:10px">* Reasoning estimated from the raw stream where the engine reports one combined count. Wall time depends on hardware and is not ranked.</p>
<h2>Pack and engine</h2><div class="panel"><dl class="kv">{''.join(f'<dt>{a}</dt><dd>{b}</dd>' for a, b in kv)}</dl></div>""" + FOOT
