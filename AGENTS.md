# Weightclass agent instructions

Before planning, launching, resuming, reviewing or publishing model runs, read
[RUN_PROTOCOL.md](RUN_PROTOCOL.md). It gives the established configuration,
published evidence and local GPU lifecycle. [SPEC.md](SPEC.md) owns the
experimental design; `setups/`, the selected prompt and `bin/run.py` own the
executable settings.

## Preserve the experiment

- Reuse the established setup and harness. Do not add or lower thinking budgets,
  response limits, whole-run token limits, step limits or wall-time stops without
  the user's explicit agreement to that specific change. A progress update or
  silence is not agreement. “Run the other models” means reuse their established
  setups, not copy limits from a troubleshooting attempt.
- Do not monkeypatch runner constants, inject limits through temporary wrappers,
  or override prompt front matter to bypass this rule. Compare the effective
  configuration against the protocol before reserving hardware. Resolve an
  unexplained difference before spending inference compute.
- Let a run finish naturally or reach its established harness guard. Long
  reasoning, repeated previews, slow tools, no file yet, and elapsed time are
  observations, not permission to kill a model or its tools. Follow the
  protocol's incident procedure for real infrastructure faults.
- Keep one-shot outputs intact: no solution hints, repair messages, external
  source edits or selective tool termination during a measured run. The model's
  own edits and checks are part of its result.
- Run local comparisons sequentially with exclusive inference hardware and a
  verified production fallback. Use Command Center's managed deployment and
  restoration paths; retain private restoration credentials until verification.
- Record actual settings, interference, stop reasons and interventions. An
  externally truncated attempt is not evidence that the model cannot finish.
  Do not quietly mix changed-budget attempts into the established comparison.
- Publish when requested, preserving model output and disclosing failures and
  experimental differences. Gallery-only work does not authorize new inference
  runs or fleet changes.

These instructions govern the operator. `harness/template/AGENTS.md` is the
separate task preamble given to the model; do not copy operator rules into model
workspaces or change that preamble as part of routine orchestration.
