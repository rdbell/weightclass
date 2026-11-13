# Model-run protocol

This is the operating procedure for Weightclass runs. Read it before spending
inference compute. The experimental design is in [SPEC.md](SPEC.md#generation-opencode-in-a-sandbox).
A request to run an existing prompt on other models preserves the established
protocol unless the user explicitly changes it.

## Evidence from the published runs

Audited the ten published `docs/runs/*/meta.json` records on 2026-11-13. Nine
Eiffel Tower/Reading room attempts ended with `agent finished`; the tenth,
GLM Scholar's Mate, was operator-stopped with changed limits. That tenth run is
an exception to disclose, not a precedent to copy.

All nine completed attempts used:

- `setup.max_output = 65536` per response;
- requested `reasoning_effort = high`, with no numerical thinking budget recorded;
- a whole-run guard of 1,000,000 generated tokens and eight repeated identical
  tool calls;
- natural agent completion, rather than an operator's elapsed-time cutoff.

All nine used more than 32,768 generated tokens (41,536–347,750). Eight ran longer
than twenty minutes. This directly rules out choosing 32K or twenty minutes as
an assumed sufficient allowance for these tasks.

The later published records establish the current execution pattern:

| Published run | Generated tokens | Elapsed seconds | Recorded overlap |
| --- | ---: | ---: | ---: |
| [Qwen27 Reading room](docs/runs/20261112T093032Z-room-open-m3-qwen27-kapitsa-s1/meta.json) | 169238 | 3585.4 | 0 |
| [GLM Reading room](docs/runs/20261112T103627Z-room-open-m3-glm53flash-omlx-s1/meta.json) | 44703 | 1240.4 | 0 |
| [DS1017 Reading room](docs/runs/20261112T113102Z-room-open-m3-ds1017-mlxserve-s1/meta.json) | 132688 | 5033.9 | 0 |
| [Qwen Flash Eiffel Tower](docs/runs/20261112T132242Z-eiffel-open-m3-qwenflash-omlx-s1/meta.json) | 284213 | 12495.1 | 0 |
| [Qwen Flash Reading room](docs/runs/20261112T185929Z-room-open-m3-qwenflash-omlx-s1/meta.json) | 347750 | 26634.5 | 0 |

These five records use `max_steps = 100000`, the runner's effectively uncapped
step setting. The four earlier Eiffel attempts used 200 steps and recorded one
overlapping run each. Those historical limitations must remain disclosed; they
are not the current sequential, exclusive-hardware procedure. Zero recorded
Weightclass overlap alone does not prove absence of external production traffic.

## 1. Establish and record the configuration before launch

Inspect the requested prompt, its previous published results, the matching
`setups/<id>.json`, and the guard in `bin/run.py`. Start with those declarations,
not a temporary script from a failed or diagnostic attempt.

Record the effective configuration in the campaign plan before reserving the GPU:

| Control | Established behavior |
| --- | --- |
| Prompt | Same version/body for the comparison; record its hash |
| Pack and engine | Exact declared revisions, version and flags |
| Sampling and effort | Preserve the setup; existing local comparisons request high |
| Numerical thinking budget | None explicitly configured for the established comparison |
| Response output allowance | 65,536 tokens, as declared by the existing local setups |
| Whole-run generated-token guard | 1,000,000, including reasoning and output across requests |
| Repeated-call guard | Eight identical consecutive tool calls, as implemented by the harness |
| Step allowance | Existing effectively uncapped runner default; do not restore the old 200-step cap |
| Wall-clock limit | None |
| Local concurrency | One measured run and one inference engine at a time |

Verify all layers: prompt front matter, setup request body, engine model settings,
proxy overrides, runner defaults, and any coordinator/wrapper. Record transport
and engine lifetime limits too: they must not silently become experiment time
limits. If a service hold or credential lease will expire, arrange a managed
extension before launch or resolve the operational blocker. Do not substitute a
shorter benchmark deadline.

Keep thinking-token budget, per-response combined output allowance, whole-run
generated-token guard, step allowance and elapsed time distinct. Effort words are
model-specific controls, not numerical token budgets. Accepted API fields are not
proof that an engine enforces them. Missing historical defaults mean unknown,
not unlimited.

Check engine releases as required by the model-swap runbook. Record the installed
and declared versions; preserve the pinned comparison setup. A new release is
not permission to upgrade mid-comparison. Resolve any required upgrade as a
separate setup change before starting.

Any proposed change to these experimental conditions requires explicit user
agreement before compute is spent. State the exact old/new values, reason and
comparison implications. Do not infer agreement from silence or from a generic
request to proceed with the existing runs. An approved variant gets a distinct
setup identity and complete metadata; never silently rewrite an earlier record.

## 2. Isolate local inference and prepare restoration

Use the owning declarations and managed tools in the sibling
[Command Center repository](../command-center/AGENTS.md). Before stopping local
production:

1. Establish the original production engine/configuration and CPA route.
2. Ensure restoration credentials remain available privately through recovery.
3. Route CPA's local alias to the authorized OpenRouter → DigitalOcean DeepSeek
   1017 fallback. Verify fresh shared and restricted-gateway inference.
4. Stop production through the managed exclusive probe. Confirm only the tested
   inference engine is running, and test authenticated connectivity from the
   actual agent-container network before beginning a measured request.

Run all local models sequentially. Do not overlap loading, warming, requests or
benchmarks on the M3. Validate the active model, not the assumption that a catalog
lists only one model. Keep inference credentials out of prompts and logs.

Keep cleanup/restoration in the coordinator's failure path. Fully stop each
probe before loading the next model. After the queue, restore the original
production service and verify a fresh completion, then restore and verify CPA's
original route. Retain credentials if recovery fails; report and repair the
restoration problem instead of claiming the campaign is complete.

## 3. Let the model perform the task

Use the existing harness and sandbox. The brief is the only message. The model
may plan, use tools, edit, preview and revise for as long as it needs within the
established guard. Capture raw calls, token usage, settings, host telemetry,
workspace snapshots and the exact end reason.

Do not stop because a run is slow, spends many tokens reasoning, has not written
`index.html`, repeats screenshots, or appears inefficient. Do not terminate an
individual tool to steer the model. Do not inject a known solution, validation
feedback or repairs. Those interventions change the experiment.

Normal stopping conditions are agent completion or the established harness
runaway guard. An explicit user stop also ends a run. A real operational incident
(crash, OOM, loss of isolation, broken authentication/transport or recovery
failure) may require stopping for recovery: preserve evidence, record the exact
incident and intervention, and restore production. Separate infrastructure
failures and operator-truncated attempts from model-quality results. Do not
invent a new time/token threshold under the name of safety or recovery.

Long-running work continues through user check-ins and context handoffs. Report
progress without converting impatience or an estimate into an automatic stop.
Persist controller identity, phase and restoration state so the next operator can
continue the same run safely.

## 4. Review and publish the actual result

Run the established independent render checks after termination. Add task-specific
checks where necessary (for chess: legal supplied moves, board states, orientation,
seeking, captures, mate and controls). A screenshot or correct source move list
alone does not prove the interactive lesson works.

Preserve the model's workspace. Keep editorial review and derived validation
separate. Gallery publication may perform its documented shared-vendor path
rewrite, not repair the output. Include real failures, missing entry points,
stop reasons, actual settings and uncertainty; absence of a file is not proof of
inability if the operator imposed an early cutoff.

When publication is requested, publish the requested attempts with that context
and verify the live deployment. Do not publish extra runs or start a new inference
campaign as a side effect of a gallery edit. If the user pauses publication,
leave it paused.

The capped Scholar's Mate attempts from 2026-11-13 must retain their changed
limits and interventions in the record. They are not completed comparisons
under the established protocol. A replacement comparison uses fresh runs with
the established configuration; historical outputs and evidence remain intact.
