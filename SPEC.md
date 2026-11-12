# Weightclass — proof-of-concept spec

Name: Weightclass (chosen 2026-11-11). It must not tie the project to one
task type: 3D scenes are the first category, not the only one. The repo and
code use "weightclass" too. Domains and trademark are not checked yet. Status: draft; harness and prompt lab work.

## Goal

Show how open-weight models, and especially their quants and repacks, perform
at 3D work: a raw gallery of every output, automatic render checks, and a
blind A/B leaderboard. Hosted frontier models appear only as reference anchors.

The proof of concept (PoC) answers two questions before any public launch:

1. Does a single three.js page separate packs visibly enough to vote on?
2. Is voting quick and fun enough that people keep doing it?

## Non-goals for the PoC

- Our own agent loop. Generation uses OpenCode, the coding agent these
  models are actually driven by, so results reflect real use. We only drive
  it and check what it leaves behind.
- AA-3D's heavy environment (Blender, physics engine, asset library,
  three-hour runs). The PoC workspace is a plain web project, one-shot
  with no time limit.
- Prerecorded videos. Thumbnails come from the harness screenshot.
- Community submissions. The data model supports them (see Trust); the PoC
  runs only our own setups.
- Matchmaking. Pairs are random.

## Prompts (owned by the user)

The user writes and curates the prompts. The PoC starts with about 10.

Each prompt is one file, `prompts/<id>.md`, with front matter:

```yaml
---
id: clock-01            # stable; never reused for different wording
title: Mechanical clock
category: object        # object | room | mechanism | physics | camera | landscape | puzzle | other
variant: open           # open | spec (see "Variants")
subject: clock          # shared by the open and spec prompts for the same scene
version: 1              # bump on any wording change; results keep the version they used
---
<the brief, in plain prose>
```

Every brief is sent with one shared task preamble (`prompts/_task.md`),
versioned the same way and placed in the workspace as `AGENTS.md`. It fixes
the deliverable so outputs are comparable:

- The result is `index.html` in the workspace root; it may load other files
  the agent writes in the workspace (JS modules, shaders). No build step.
- three.js only, from the vendored copy in `vendor/three/` (one pinned version
  for the whole run). No network requests, no external assets; textures and
  geometry are procedural.
- Fills the viewport, resizes with it, and starts animating without input.
  Orbit controls are allowed (from the same pinned three.js version).
- Deterministic where it matters: seeded randomness, so two loads look alike.

Prompt changes after results exist create a new version; old results stay
listed under the version they answered.

### Variants

A subject can have two prompts that measure different things. Either may
exist alone.

- **Open** (`variant: open`): outcomes, not steps. The model decides
  proportions, palette, camera, technique and extra detail. Outputs differ,
  so this is what people vote on; it feeds the main leaderboard.
- **Spec** (`variant: spec`): a hard specification (numbers, code, palettes).
  It measures instruction following; outputs converge, so votes would be
  noise. Not paired for voting. Scored by the shared automatic checks plus
  review against the spec text (the spec is the rubric), and by tokens used:
  with one fixed target, tokens are a fair efficiency measure. No per-prompt
  check scripts for now.

Open and spec results are never mixed in one rating. Listing pages show the
variant next to the title, e.g. "Eiffel Tower (open)" / "(spec)".

## Prompt lab (exploration, not results)

Finding good prompts happens on fast hosted models through OpenRouter, so a
draft prompt is judged in minutes instead of a night of local runs.

- Same harness as real runs (current OpenCode, template, container, runaway
  guard), so a prompt behaves the same way when it moves to local runs. Only
  the endpoint differs.
- Two or three hosted models from different families, e.g. the hosted
  versions of our local models (DeepSeek V4.1 Flash 1017, GLM-5.3-Flash, a
  Qwen) on fast pinned providers. Tuning prompts against one model would bias
  the set towards that model.
- A good prompt separates models: not everyone fails, not everyone nails it,
  and the outputs differ visibly. The lab view shows a draft's outputs side
  by side with their checks to judge that quickly.
- Lab runs are marked `lab`, kept out of the gallery, votes and leaderboard,
  and tied to the draft prompt text they used. A prompt is promoted to
  `prompts/` (version 1) only when the user accepts it.
- Paid: OpenRouter bills each run. A lab batch of ~10 drafts x 3 models is a
  few dollars; the lab prints an estimate before a batch starts.

## Setups (PoC)

| Setup | Engine | Notes |
|---|---|---|
| GLM-5.3-Flash oQ4e | oMLX | needs an engine swap on M3Ultra256 |
| DeepSeek V4.1 Flash 1017 iQ-MLX 3.0 | mlx-serve | needs an engine swap |
| Qwen3.8-27B (production pack) | Kapitsa 0.2.34 | live today |
| DeepSeek V4.1 Flash 1017 hosted | OpenRouter, pinned provider | reference anchor; paid (small) |

A setup is the exact tuple: model, pack repo and revision, engine and version,
engine flags, sampling settings, effort/thinking setting. Any change makes a
new setup.

## Generation: OpenCode in a sandbox

For each (prompt, setup, sample), 2 samples per pair, one fresh run:

1. **Workspace:** a new directory from a fixed template: `AGENTS.md` (the
   task preamble), `vendor/three/` (pinned), an empty `index.html`, and a
   `preview` command that serves the workspace locally and saves a headless
   screenshot plus console log (so the agent can look at its own result, as a
   developer would).
2. **Agent:** the current OpenCode release (see Harness versions), run non-interactively with the brief
   as the task, pointed at the setup's endpoint and model. One fixed OpenCode
   config for all setups: same tools (files, shell, `preview`), same system
   prompt, no MCP servers or plugins beyond `preview`.
3. **Container:** each run in a throwaway container with no network except
   the model endpoint, through a per-run recording relay that forwards to
   that one origin and logs every call; the workspace is the only
   writable mount. OpenCode's own hosts stay blocked: `opencode.ai` serves
   its free models (a silent fallback if the provider fails to load) and
   `models.opencode.ai` a live catalog that changes request parameters
   without a version change. The model is always named with `--model`. The agent
   runs shell commands, so this is required, not optional.
   No web search or fetch, by decision: once the gallery is public, a search
   for the same brief could find other models' published outputs and copy
   them. Offline runs also stay reproducible, which the spot re-run check
   for community submissions depends on. Optional (off by default): a pinned
   local copy of the three.js docs and examples in `vendor/three-docs/`, for
   the look-it-up part of real coding without access to anyone's results.
4. **One-shot, no time limit:** the brief is the only message. No follow-up
   or repair turns from us, and no wall-clock limit: the agent works until it
   says it is done. Time limits and follow-ups would let faster hardware buy
   better results, which defeats the comparison. The agent's own steps within
   the run (edit, preview, fix) are its choice and count as part of the
   result. Only a runaway guard ends a run early, and it is
   hardware-independent: a budget of generated tokens (default 1M output +
   reasoning over all model requests; re-sent input is excluded because it
   depends on the engine's caching, decided 2026-11-12) and a loop detector for repeated identical tool calls. No step
   cap: steps are the agent's choice, and long tasks need many (decided
   2026-11-12; the first local round still ran under a 200-step cap). A
   prompt may set `max_steps` or `max_tokens` in its front matter. A guard
   stop is recorded and the existing `index.html` is still judged.
5. **Record:** the full OpenCode session export (turns, tool calls, tokens,
   timings), the final workspace (content-addressed; immutable), and why the
   run ended.
6. **Render:** our own headless Chromium (Playwright) pass, independent of the
   agent's `preview`, under the same sandbox policy as the site: load, run
   5 s, console errors, 1280×800 screenshot, blank-canvas check, frame rate.

Wall time and tok/s are recorded and shown, but never limit a run or enter
the ranking. Runs are sequential on M3Ultra256; hosted runs can go in parallel.

PoC volume: 10 prompts × 4 setups × 2 samples = 80 runs. With no time limit,
local duration is open-ended; at ~10-30 min per local run, the three local
setups take roughly 2-3 nights. Hosted runs take about an hour.

## Harness versions

OpenCode, Playwright and three.js are kept at their latest releases (the
fleet's 20-day npm release-age rule is overridden for this image only).
OpenCode is kept at its latest release, but an upgrade can change results
(system prompt, tools, edit format, context handling). So:

- **Every result records a harness fingerprint:** OpenCode version, a hash of
  our OpenCode config, the workspace template hash, the container image
  digest and the render-check version. The gallery and leaderboard show the
  OpenCode version, and anyone can filter by it.
- **Upgrade only between batches.** A setup's runs for one batch all use one
  harness fingerprint, so a single setup is never split across versions
  mid-batch.
- **Anchor re-runs on every upgrade:** re-run a small fixed subset (e.g. 3
  prompts x 2 hosted setups x 2 samples, cheap on OpenRouter) on the new
  version and compare render, error and guard-stop rates, turns and tokens
  against the previous version.
- **Epochs:** if the anchors show no meaningful change, the new version joins
  the current epoch and results pool. If they do, a new epoch starts: the
  leaderboard shows the current epoch by default (older epochs stay
  browsable), and older setups are re-run in the new epoch as time allows.
  The epoch decision and its anchor evidence are published.
- Random vote pairs stay within one epoch.

## Automatic checks (vote-free)

Per output: rendered, console errors, blank canvas, frame rate, guard stop
or not. Per setup: render rate, error rate, blank rate, guard-stop rate,
median steps and tokens. Tokens are published per output: generated
(output and reasoning separately), fresh input and cached input, since they
matter to people running a model locally. Wall time is hardware-dependent and
shown for information only, never ranked. Shown on day one, with zero votes.

## Site

Three pages, static where possible:

- **Gallery:** every prompt with every setup's outputs side by side. Filters by
  model, pack, engine, category and check result. Thumbnails are the
  render screenshots; a scene loads live only when clicked. Each output links
  its OpenCode transcript (turns, tool calls, time), which is a useful view
  of how a pack worked, not just what it made.
- **Vote:** a random prompt and two random outputs for it, unlabeled. "Left /
  right / tie / both broken." Labels appear after the vote.
- **Leaderboard:** Bradley-Terry ratings with confidence intervals and vote
  counts (open prompts), plus the automatic-check table.
- **Spec board:** per setup, spec prompts passed on review, check results and
  tokens used, separate from the ratings.

Private for the PoC (link-only, you and friends).

### Sandbox (non-negotiable)

Visitors run model-written JavaScript, so:

- Scenes are served from a separate origin that holds no cookies, sessions or
  vote API.
- Each scene runs in `<iframe sandbox="allow-scripts">` (no same-origin, forms,
  popups, top navigation or downloads).
- Scene responses carry a CSP allowing scripts only from the pinned three.js
  URL plus the inline page; `connect-src 'none'`; no other network.
- Scene files are static, immutable and content-addressed.

## Voting

- Unit: one vote = (prompt id+version, output A, output B, choice, voter, time).
- Random pairs of different setups on the same prompt version, open variant
  only.
- Failed runs stay in the pool (decided 2026-11-12): a model or engine failure
  (e.g. a tool call emitted as text, ending the run with an unfinished page)
  is a result. It loses its pairs unless both sides failed, which is the
  intended penalty for an incomplete task. Re-runs only for harness or
  infrastructure faults, and the original stays on record.
- Light abuse controls for the PoC: one anonymous voter id per browser and a
  rate limit. Before going public: control pairs (a clear winner against a
  broken scene), voter quality scoring and dropping voters who fail them.
- Ratings: Bradley-Terry fit over all votes (ties as half wins), bootstrap
  confidence intervals; re-fit on demand.

## Trust (designed now, used after the PoC)

Two independent labels:

- **Entry tier:** *verified* (we generated it) or *community* (submitted).
- **Submitter trust:** *trusted* or *untrusted*. Trust is earned, not claimed:
  a submitter whose spot-checked results match our re-runs over time becomes
  trusted. Trusted community entries can rank beside verified ones; untrusted
  ones stay badged and can be filtered out.

Submission (post-PoC) uses our open harness (the current epoch's OpenCode
version, config, template and runaway guard), not uploads. It records engine
and version, the SHA-256 of each weight file checked against the pack's
published Hugging Face manifest, settings and timings, and runs a short hidden
fingerprint probe (about 20 fixed prompts, greedy, first 64 tokens, logprobs
when available) compared against our reference for the claimed pack.
Mismatches are flagged, not auto-rejected: engines differ slightly.

Spot re-runs: for packs we can run, we regenerate a random few of a
submitter's prompts and compare render rates and vote outcomes. Consistent
outperformance against our runs flags the submitter.

## Data layout

```
prompts/            <id>.md, _system.md                (user-owned)
setups/             <setup-id>.json                    (exact tuple, see Setups)
runs/<run-id>/      run.json (harness version, prompts and setups used)
harness/            workspace template, OpenCode config, container image,
                    preview tool; epochs.json (versions, anchors, decisions)
outputs/<sha256>/   the run record (README.md, "Run record"): meta.json,
                    raw model calls, events, OpenCode session store,
                    per-step workspace history, host samples, workspace/,
                    checks.json and screenshots
votes               append-only store (SQLite for the PoC)
```

## PoC milestones

1. Harness first, then the prompt lab: the user drafts prompts and iterates
   on hosted models until about 10 are accepted; the task preamble is agreed.
2. Harness generates and renders Qwen27 (live) and the hosted reference.
3. GLM and DeepSeek during an engine-swap window (CPA on the hosted route
   meanwhile, restored afterwards).
4. Gallery and checks table.
5. Vote page and leaderboard; private voting.
6. Review: did pairs separate packs, did people keep voting? Decide on public
   launch and hosting.

## Open decisions

- Branding (logo, domain); the name is Weightclass.
- Hosting: DOKS with a new domain, or static hosting plus a small vote API.
- Sampling settings: each model's card defaults, or one shared setting.
- Thinking on or off for generation (cost vs quality), per setup.
- The runaway guard's exact budget, and whether the agent gets the
  `preview` screenshot (vision-capable models only) or console log alone.
- Should OpenCode run against the engines directly or through CPA (CPA maps
  efforts; direct keeps one less moving part)?
- Whether ties and "both broken" count in ratings or only in checks.
