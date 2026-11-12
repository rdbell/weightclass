# M3 window: room-open v1 on three local packs

Prompt `prompts/room-open.md` v1 (brief sha256 `3999ad59…`), open variant,
one sample per setup, one run at a time (no engine sharing).

| order | setup | engine | swap |
|---|---|---|---|
| 1 | `m3-qwen27-kapitsa` | Kapitsa 0.2.34 | none (production) |
| 2 | `m3-glm53flash-omlx` | oMLX 0.7.4.dev1 | `local_llm.yml -e @glm53flash-omlx.yml` |
| 3 | `m3-ds1017-mlxserve` | mlx-serve 26.11.2 | `local_llm.yml -e @ds1017-mlxserve.yml` |
| — | restore | Kapitsa | `local_llm.yml` (host_vars only), then again for idempotence |

Before: route CPA's `m3-ultra-local` to DigitalOcean from a clean server
worktree (`m3_ultra_route.py digitalocean`, commit, `doks_apply_cli_proxy_api.sh
--stage` then apply). After: deploy server master (local route) the same way.
Both need the SOPS age key (T3 secret, deleted afterwards).

Per pack: `--check --diff` preview, apply, `/v1/models` lists
`m3-ultra-local`, smoke run (`prompts/lab/smoke-cube.md`) checks reasoning
tokens and cache hits, then the room run. Environment for local setups:
`WC_M3_BASE_URL`, `WC_M3_HOST_HEADER`, `WC_M3_SSH`, `WC_M3_KEY` (from
command-center `secrets/splash/m3ultra256.sops.yaml`, deleted afterwards).

Expected: Qwen 27B ~1–1.5 h, GLM ~0.5–1 h, DeepSeek ~1.5–2.5 h (Eiffel-open
times, without the engine sharing of that round), plus ~30 min of swaps and
smoke runs: about 4–5.5 h.
