# Weightclass

How open-weight models and their quants do at 3D scenes, driven through
OpenCode the way people actually use them. Design: [SPEC.md](SPEC.md).
3D scene runs use open-spec prompts: describe the outcome and constraints, and
let the model choose the implementation and visual details. Historical hard-spec
runs stay in the lab archive and are excluded from the website.

## Run policy

Before launching or resuming model runs, read [AGENTS.md](AGENTS.md) and
[RUN_PROTOCOL.md](RUN_PROTOCOL.md). The protocol is grounded in the published
run records and preserves the established experimental settings.

## Setup (once)

```sh
bash harness/fetch_vendor.sh 0.187.0                     # pinned three.js, integrity-checked
docker build -t weightclass/harness:dev harness        # OpenCode + Chromium + scene tool
```

Runs need Docker. Nothing uses a GPU: scenes render with Chromium's software
WebGL (SwiftShader).

## Prompt lab

Draft prompts go in `prompts/lab/` (front matter as in SPEC.md). Try one on
the three hosted lab models:

```sh
OPENROUTER_API_KEY=... bin/lab.py prompts/lab/my-draft.md
#   --samples 2          two runs per model
#   --setups a,b         setups/ ids to use
#   --yes                skip the cost question
```

It prints a rough cost estimate first, then writes `lab/<batch>/index.html`
(screenshots, checks, wall time, tool calls, transcripts, actual spend).
Open a scene live (loopback only, the site's sandbox policy; use a private
browser window):

```sh
bin/serve.py lab/<batch>/<run>
```

Accepted prompts move to `prompts/` as version 1.

## One run

```sh
OPENROUTER_API_KEY=... bin/run.py --setup setups/or-ds1017-fast.json \
    --brief prompts/lab/smoke-cube.md [--lab] [--sample 2]
```

The brief is the only message; no time limit. The agent container's only
network peer is the run's recording relay (`harness/recorder/relay.py`),
which forwards to the setup's endpoint origin and nowhere else; OpenCode's
own hosts are unreachable on purpose (SPEC.md, "Container"). A runaway guard
(1M generated tokens, 8 identical tool calls in a row; no step cap) is the only early
stop; a prompt can set `max_steps`/`max_tokens` in its front matter.

The agent has `preview` (one screenshot and the console log) and, in the
same container, the judged render's tool (`node /opt/weightclass/scene.mjs
check DIR OUT`), which it may find and use; see SPEC.md, "Workspace".

### Run record

Collected because it cannot be recovered later:

| path | what |
|---|---|
| `meta.json` | setup and its hash, prompt (id, version, variant, hash), harness fingerprint, start/end, end reason, overlapping runs; summaries of tokens, agent tools and errors, model calls (TTFT, decode, finish reasons, truncation, cached prompt tokens), OpenRouter cost and providers, host energy and thermal state, code size |
| `record/raw/` | every model call: request as sent (system prompt, tools, sampling; credentials redacted) and the streamed response with per-chunk times, incl. reasoning text; `calls.jsonl` index |
| `record/events.jsonl` | OpenCode's event stream |
| `record/opencode-home/` | OpenCode's session database and logs |
| `record/history.git` | workspace after every agent step (bare repo; `git --git-dir=record/history.git log`) |
| `record/generations.jsonl` | hosted: OpenRouter's per-call record (provider, cost) |
| `record/host/` | local: machine snapshot at start and end (OS, chip, memory, engine process and flags), 30 s memory samples, powermetrics stream (CPU+GPU+ANE power, thermal pressure every 5 s) |
| `workspace/` | final files |
| `checks.json`, `screenshot.png`, `shots/` | judged render (check v2): errors and warnings, fps, draw calls and triangles per frame, blank test, animation and second-load diffs, one screenshot per mode (`modes`/`mode_param` front matter), mode-button clicks |

Everything derived from `workspace/` (renders, checks) can be redone later
with the pinned image.

## Gallery

`bin/gallery.py RUN_DIR...` builds the static site in `docs/` (published with
GitHub Pages): a home page (tasks, and a filterable matrix of setups against
tasks), one page per task (`tasks/<id>/`: large live viewer in a sandboxed
iframe, compare, screenshots, run details, attempts) and one page per setup
(`setups/<id>/`: pack, quant and engine, and every attempt it has run). The only
change to a model's files is the three.js path, rewritten to one shared
copy. `bin/backfill.py` adds what can be derived after a run (token split
from raw calls, re-check with the current render check) without changing
the original record.

### Local packs

Local scene trials require exclusive GPU access. Before stopping production,
route CPA's local alias to the authorized OpenRouter/DigitalOcean DeepSeek 1017
fallback and verify fresh shared and restricted-gateway inference. Use
command-center's managed exclusive probe; do not serve a second model alongside
production for these runs. Keep restoration credentials available until the
original service and CPA route have both been restored and verified. Capture
host telemetry and confirm that only the tested inference engine is running.


`packs/` holds each pack's file manifest (`bin/pack_manifest.py`, from the
hashes command-center pins). Local setups (`setups/m3-*.json`) name the pack
and manifest hash, the engine and its settings, and the machine to sample
over SSH (read-only; `powermetrics` uses the M3's existing sudo). Private
endpoints stay out of the repository: local setups name environment
variables instead (`WC_M3_BASE_URL`, `WC_M3_HOST_HEADER`, `WC_M3_SSH`, and
the key in `WC_M3_KEY`).

## Versions

The image uses the latest releases of OpenCode (`@opencode/cli`), Playwright
and three.js at build time, overriding the fleet's 20-day npm release-age
rule for this image only. Every result records the exact versions.

### Reasoning controls in run records

Record reasoning effort, any numerical thinking budget (tokens per response),
and the combined output-token limit separately in each setup snapshot. Record
engine defaults explicitly when known; an absent budget in a historical record
means the effective engine/provider default is unknown, not unlimited.
Changed budgets are different experimental settings. Coordinator interventions
and incomplete attempts must remain visible in the trial review.
