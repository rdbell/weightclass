#!/usr/bin/env python3
"""Run one one-shot OpenCode generation and its judged render.

  bin/run.py --setup setups/or-qwen27-fast.json \
      --brief prompts/lab/eiffel-open.md --sample 1 [--lab] [--out runs]

The brief is the only message. No time limit; a hardware-independent runaway
guard (step/token budget, repeated identical tool calls) stops a run early.

Network: the agent container sits on an internal Docker network whose only
member besides it is this run's recording relay (harness/recorder/relay.py).
The relay forwards to the setup's endpoint origin and nowhere else, and
records every model call (request, streamed response with timings).

Record (run directory):
  meta.json            setup, prompt, harness fingerprint, end reason, and
                       summaries (tokens, calls, errors, host, code)
  record/events.jsonl  OpenCode's event stream
  record/raw/          every model call, see relay.py
  record/opencode-home OpenCode's own session store and logs
  record/history.git   workspace snapshot after every agent step (bare git
                       repo, made by the host; the agent never sees it)
  record/generations.jsonl  OpenRouter's per-call record (hosted setups)
  record/host/         machine snapshots, 30 s samples, power (local setups)
  workspace/           the final workspace
  checks.json, screenshot.png, shots/   the judged render

The endpoint key is read from the environment variable the setup names
(api_key_env) and handed to the container by name, never on a command line.
"""
import argparse
import datetime
import gzip
import hashlib
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
HARNESS = ROOT / "harness"
IMAGE = os.environ.get("WC_IMAGE", "weightclass/harness:dev")
THREE_VERSION = "0.187.0"
NETWORK = "weightclass-internal"
RELAY_IMAGE = "python:3.13-alpine"
ACTIVE = Path(os.environ.get("WC_ACTIVE_DIR", str(Path.home() / ".local/state/weightclass/runs")))

# Runaway guard: hardware-independent limits only.
# No step cap by default: steps are not a runaway signal (long tasks need
# many). A prompt may set max_steps / max_tokens in its front matter.
STEP_CAP_DEFAULT = 100_000   # effectively none; OpenCode needs a number
MAX_TOKENS = 1_000_000     # generated tokens (output + reasoning), all model requests
MAX_REPEATS = 8            # identical consecutive tool calls
SAMPLE_SECONDS = 30        # host and concurrency samples


def sh(*args, check=True, capture=True, **kw):
    return subprocess.run(args, check=check, text=True, capture_output=capture, **kw)


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_tree(path, skip=(".preview", "vendor")):
    h = hashlib.sha256()
    for f in sorted(p for p in Path(path).rglob("*") if p.is_file()):
        rel = f.relative_to(path)
        if rel.parts and rel.parts[0] in skip:
            continue
        h.update(str(rel).encode() + b"\0" + f.read_bytes() + b"\0")
    return h.hexdigest()


def read_brief(path):
    text = Path(path).read_text()
    meta = {}
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if m:
        for line in m.group(1).splitlines():
            k, _, v = line.partition(":")
            if k.strip():
                meta[k.strip()] = v.split("#", 1)[0].strip()
        text = m.group(2)
    return meta, text.strip() + "\n"


def utc(ts=None):
    return datetime.datetime.fromtimestamp(ts or time.time(), datetime.timezone.utc).isoformat()


def opencode_config(setup, base_url, max_steps):
    body = dict(setup.get("request_body") or {})
    return {
        "$schema": "https://opencode.ai/config.json",
        "providers": {"weightclass": {
            "type": "openai-compatible",
            # Without "package" OpenCode cannot load the provider and, when no
            # --model is given, silently falls back to its own free models.
            "package": "@ai-sdk/openai-compatible",
            "settings": {"baseURL": base_url, "apiKey": "{env:WC_API_KEY}"},
            "models": {"target": {
                "modelID": setup["model_id"],
                "limit": {"context": setup["context"], "output": setup["max_output"]},
                # Model-level "body" is merged into every request; the
                # agent-level request.body is ignored by OpenCode 2.2.7.
                "body": body,
            }},
        }},
        "model": "weightclass/target",
        "tools": {"webfetch": False, "websearch": False},
        "permissions": [{"action": "webfetch", "resource": "*", "effect": "deny"}],
        "agents": {"build": {"steps": max_steps}},
    }


def ensure_network():
    import fcntl
    with open("/tmp/weightclass-network.lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if sh("docker", "network", "inspect", NETWORK, check=False).returncode:
            sh("docker", "network", "create", "--internal", NETWORK)


def start_relay(name, upstream, raw, uid, host_header=None):
    """The run's only network exit: records and forwards to one origin."""
    sh("docker", "run", "-d", "--name", name, "--user", uid,
       "-e", f"WC_HOST_HEADER={host_header or ''}",
       "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
       "--read-only", "--memory", "512m",
       "-e", f"WC_UPSTREAM={upstream}", "-e", "WC_RAW=/raw",
       "-v", f"{HARNESS / 'recorder' / 'relay.py'}:/relay.py:ro", "-v", f"{raw}:/raw",
       RELAY_IMAGE, "python", "-u", "/relay.py")
    sh("docker", "network", "connect", "--alias", name, NETWORK, name)
    for _ in range(30):
        if "relay on" in sh("docker", "logs", name, check=False).stderr:
            return
        time.sleep(1)
    raise SystemExit(f"relay {name} did not start")


def walk(obj):
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from walk(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk(v)


class Snapshots:
    """Commit the workspace to a bare repo in the record after each step.
    Host-side git; the agent's workspace never contains a .git."""

    def __init__(self, work, repo):
        self.env = {**os.environ, "GIT_DIR": str(repo), "GIT_WORK_TREE": str(work),
                    "GIT_AUTHOR_NAME": "weightclass", "GIT_AUTHOR_EMAIL": "harness@weightclass",
                    "GIT_COMMITTER_NAME": "weightclass", "GIT_COMMITTER_EMAIL": "harness@weightclass"}
        subprocess.run(["git", "init", "-q", "--bare", str(repo)], check=True)
        (repo / "info").mkdir(exist_ok=True)
        (repo / "info" / "exclude").write_text("/vendor/\n")
        self.count = 0
        self.commit("start")

    def commit(self, message):
        subprocess.run(["git", "add", "-A"], env=self.env, check=False, capture_output=True)
        subprocess.run(["git", "commit", "-q", "--allow-empty", "-m", message],
                       env=self.env, check=False, capture_output=True)
        self.count += 1


class Guard:
    """Watches the run: stops runaway runs and snapshots the workspace.

    Token budget and snapshots follow the relay's call log, which sees every
    model request, including those of sub-agents the model starts; OpenCode's
    events cover only the main session. Repeated identical tool calls are
    detected from the main session's events."""

    def __init__(self, events, calls, container, snapshots, max_tokens):
        self.events, self.calls, self.container, self.snapshots = events, calls, container, snapshots
        self.max_tokens = max_tokens
        self.reason, self.tool_calls, self.tokens, self.steps, self.model_calls = None, 0, 0, 0, 0
        self.last_call, self.repeats = None, 0
        self.stop = threading.Event()

    def _tool_call(self, ev):
        for d in walk(ev):
            tool = d.get("tool")
            state = d.get("state")
            if isinstance(tool, str) and isinstance(state, dict) and state.get("status") in ("completed", "error"):
                return tool + json.dumps(state.get("input"), sort_keys=True)
        return None

    @staticmethod
    def _lines(path, pos):
        if not path.exists():
            return pos, []
        out = []
        with path.open() as f:
            f.seek(pos)
            for line in f:
                if not line.endswith("\n"):
                    break
                pos += len(line.encode())
                try:
                    out.append(json.loads(line))
                except ValueError:
                    pass
        return pos, out

    def run(self):
        epos = cpos = 0
        while not self.stop.is_set():
            cpos, calls = self._lines(self.calls, cpos)
            for c in calls:
                # Generated tokens only: re-sent input depends on how well
                # the engine caches, which is hardware/provider-dependent.
                u = c.get("usage") or {}
                self.tokens += int(u.get("completion_tokens") or 0)
                if c.get("method") == "POST":
                    self.model_calls += 1
                    self.snapshots.commit(f"model call {c.get('n')}")
            epos, evs = self._lines(self.events, epos)
            for ev in evs:
                if ev.get("type") == "step_finish":
                    self.steps += 1
                call = self._tool_call(ev)
                if call:
                    self.tool_calls += 1
                    self.repeats = self.repeats + 1 if call == self.last_call else 1
                    self.last_call = call
            if self.tokens > self.max_tokens:
                self.reason = f"guard: token budget ({self.max_tokens})"
            elif self.repeats >= MAX_REPEATS:
                self.reason = f"guard: {MAX_REPEATS} identical tool calls in a row"
            if self.reason:
                sh("docker", "stop", "-t", "10", self.container, check=False)
                return
            time.sleep(2)


class Concurrency:
    """Which other runs overlapped this one in time (they may share the
    engine). Every run leaves {start, end, endpoint, pid} in ACTIVE; overlap
    is computed from the intervals, so it is symmetric and exact."""

    def __init__(self, name, endpoint):
        ACTIVE.mkdir(exist_ok=True)
        self.mine = ACTIVE / f"{name}.json"
        self.rec = {"start": time.time(), "end": None, "endpoint": endpoint, "pid": os.getpid()}
        self.mine.write_text(json.dumps(self.rec))

    def sample(self):
        pass

    def close(self):
        self.rec["end"] = time.time()
        self.mine.write_text(json.dumps(self.rec))
        out = []
        for f in ACTIVE.glob("*.json"):
            if f == self.mine:
                continue
            try:
                o = json.loads(f.read_text())
            except (ValueError, OSError):
                continue
            o_end = o.get("end")
            if o_end is None:  # still running, or died without closing
                try:
                    os.kill(int(o.get("pid")), 0)
                    o_end = time.time()
                except (TypeError, ValueError, OSError):
                    continue
            if o["start"] < self.rec["end"] and o_end > self.rec["start"]:
                out.append({"run": f.stem, "endpoint": o.get("endpoint"),
                            "overlap_seconds": round(min(o_end, self.rec["end"]) - max(o["start"], self.rec["start"]), 1)})
        return sorted(out, key=lambda x: x["run"])


HOST_SNAPSHOT = r"""
echo "## date"; date -u +%Y-%m-%dT%H:%M:%SZ
echo "## sw_vers"; sw_vers
echo "## hw"; sysctl -n machdep.cpu.brand_string hw.memsize hw.ncpu
echo "## gpu"; system_profiler SPDisplaysDataType 2>/dev/null | grep -iE 'chipset|cores|metal'
echo "## uptime"; uptime
echo "## memory_pressure"; memory_pressure -Q 2>/dev/null | tail -1
echo "## vm_stat"; vm_stat
echo "## swap"; sysctl -n vm.swapusage
echo "## top_rss"; ps -axo pid,rss,etime,args -m | head -8
"""
HOST_SAMPLE = r"""
date -u +%s; memory_pressure -Q 2>/dev/null | tail -1; sysctl -n vm.swapusage;
vm_stat | grep -E 'Pages (free|active|wired down|occupied by compressor)';
ps -axo rss,args -m | head -3
"""


class Host:
    """Local setups: snapshots of the serving machine, 30 s samples, and a
    continuous powermetrics stream (CPU/GPU/ANE power, thermal pressure)."""

    def __init__(self, cfg, out):
        self.ssh, self.out = cfg["ssh"], out
        self.engine_match = cfg.get("engine_match")
        self.engine_log = cfg.get("engine_log")
        self.log_offset = None
        out.mkdir(parents=True, exist_ok=True)
        self.stop = threading.Event()
        self.power = None

    def run_ssh(self, script, timeout=60):
        try:
            return subprocess.run(["ssh", "-o", "BatchMode=yes", self.ssh, script], text=True,
                                  capture_output=True, timeout=timeout).stdout
        except subprocess.TimeoutExpired:
            return ""

    def snapshot(self, label):
        script = HOST_SNAPSHOT
        if self.engine_match:
            script += f'echo "## engine"; ps -axo pid,rss,lstart,args | grep -F -- {json.dumps(self.engine_match)} | grep -v grep\n'
        (self.out / f"{label}.txt").write_text(self.run_ssh(script))

    def start(self):
        self.snapshot("start")
        if self.engine_log:
            out = self.run_ssh(f"stat -f%z {self.engine_log} 2>/dev/null || echo 0").strip()
            self.log_offset = int(out) if out.isdigit() else 0
        f = gzip.open(self.out / "power.txt.gz", "wt")
        self.power_file = f
        self.power = subprocess.Popen(
            ["ssh", "-o", "BatchMode=yes", self.ssh,
             "sudo -n powermetrics -i 5000 --samplers cpu_power,gpu_power,ane_power,thermal"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        threading.Thread(target=self._pump, daemon=True).start()
        threading.Thread(target=self._sample, daemon=True).start()

    def _pump(self):
        for line in self.power.stdout:
            self.power_file.write(f"{time.time():.1f}\t{line}")

    def _sample(self):
        with open(self.out / "samples.txt", "a") as f:
            while not self.stop.is_set():
                f.write(f"## {time.time():.0f}\n{self.run_ssh(HOST_SAMPLE, timeout=25)}")
                f.flush()
                self.stop.wait(SAMPLE_SECONDS)

    def finish(self):
        self.stop.set()
        if self.power:
            self.power.terminate()
            try:
                self.power.wait(10)
            except subprocess.TimeoutExpired:
                self.power.kill()
        time.sleep(1)
        self.power_file.close()
        self.snapshot("end")
        if self.engine_log and self.log_offset is not None:
            # The engine log written during this run (shared engine: other
            # overlapping runs' lines are included).
            res = subprocess.run(["ssh", "-o", "BatchMode=yes", self.ssh,
                                  f"tail -c +{self.log_offset + 1} {self.engine_log} | gzip -c"],
                                 capture_output=True, timeout=300)
            (self.out / "engine.log.gz").write_bytes(res.stdout)
        return self.summary()

    def summary(self):
        watts, thermal, ts = [], set(), []
        with gzip.open(self.out / "power.txt.gz", "rt") as f:
            for line in f:
                t, _, text = line.partition("\t")
                m = re.search(r"Combined Power \(CPU \+ GPU \+ ANE\): (\d+) mW", text)
                if m:
                    watts.append(int(m.group(1)) / 1000)
                    ts.append(float(t))
                m = re.search(r"Current pressure level: (\w+)", text)
                if m:
                    thermal.add(m.group(1))
        if not watts:
            return {"power_samples": 0}
        interval = 5.0
        return {"power_samples": len(watts), "avg_watts": round(statistics.mean(watts), 1),
                "max_watts": round(max(watts), 1),
                "energy_wh": round(sum(watts) * interval / 3600, 2),
                "thermal_levels": sorted(thermal)}


def image_info():
    out = sh("docker", "image", "inspect", IMAGE, "-f",
             "{{.Id}} {{index .Config.Labels \"org.weightclass.opencode\"}} "
             "{{index .Config.Labels \"org.weightclass.playwright\"}}").stdout.split()
    return {"image_id": out[0], "opencode": out[1], "playwright": out[2]}


def read_events(events):
    if not events.exists():
        return []
    out = []
    for line in events.read_text().splitlines():
        try:
            out.append(json.loads(line))
        except ValueError:
            pass
    return out


def stream_split(path):
    """Characters of reasoning, content and tool-call arguments in one
    streamed response (to apportion tokens when the engine reports one
    combined completion count)."""
    r = c = t = 0
    raw = ""
    with gzip.open(path, "rt") as f:
        for line in f:
            try:
                raw += json.loads(line).get("d", "")
            except ValueError:
                pass
    for line in raw.splitlines():
        if not line.startswith("data: {"):
            continue
        try:
            d = json.loads(line[6:])
        except ValueError:
            continue
        for ch in d.get("choices") or []:
            delta = ch.get("delta") or {}
            r += len(delta.get("reasoning_content") or delta.get("reasoning") or "")
            c += len(delta.get("content") or "")
            for tc in delta.get("tool_calls") or []:
                t += len(((tc or {}).get("function") or {}).get("arguments") or "")
    return r, c, t


def raw_token_totals(raw):
    """Token totals over every model request the relay saw (main session and
    sub-agents). Reasoning as reported by the engine, else estimated from
    the reasoning share of the streamed characters (method recorded)."""
    f = raw / "calls.jsonl"
    if not f.exists():
        return None
    t = {"model_calls": 0, "failed_calls": 0, "input": 0, "cache_read": 0,
         "output": 0, "reasoning": 0, "generated": 0, "reasoning_method": []}
    methods = set()
    for line in f.read_text().splitlines():
        c = json.loads(line)
        if c.get("method") != "POST":
            continue
        t["model_calls"] += 1
        if c.get("status") != 200:
            t["failed_calls"] += 1
        u = c.get("usage") or {}
        prompt = int(u.get("prompt_tokens") or 0)
        cached = int((u.get("prompt_tokens_details") or {}).get("cached_tokens") or 0)
        comp = int(u.get("completion_tokens") or 0)
        t["input"] += max(0, prompt - cached)
        t["cache_read"] += cached
        t["generated"] += comp
        rep = (u.get("completion_tokens_details") or {}).get("reasoning_tokens")
        if rep is not None:
            t["reasoning"] += int(rep)
            methods.add("reported")
        elif comp:
            resp = raw / f"{c['n']:04d}.resp.jsonl.gz"
            if resp.exists():
                r, ct, tc = stream_split(resp)
                tot = r + ct + tc
                t["reasoning"] += round(comp * r / tot) if tot else 0
                methods.add("estimated from reasoning character share")
    t["output"] = t["generated"] - t["reasoning"]
    t["reasoning_method"] = sorted(methods)
    return t


def token_totals(evs):
    """Sum per-step usage from step_finish events. OpenCode reports output
    and reasoning separately; input excludes cache reads."""
    t = {"steps": 0, "input": 0, "cache_read": 0, "cache_write": 0, "output": 0, "reasoning": 0}
    for ev in evs:
        if ev.get("type") != "step_finish":
            continue
        tok = (ev.get("part") or {}).get("tokens") or {}
        cache = tok.get("cache") or {}
        t["steps"] += 1
        for k in ("input", "output", "reasoning"):
            t[k] += int(tok.get(k) or 0)
        t["cache_read"] += int(cache.get("read") or 0)
        t["cache_write"] += int(cache.get("write") or 0)
    t["generated"] = t["output"] + t["reasoning"]
    return t


def agent_summary(evs):
    tools, errors, preview, finish = {}, 0, 0, {}
    for ev in evs:
        p = ev.get("part") or {}
        if ev.get("type") == "tool_use":
            tools[p.get("tool")] = tools.get(p.get("tool"), 0) + 1
            st = p.get("state") or {}
            if st.get("status") == "error":
                errors += 1
            if "preview" in json.dumps(st.get("input") or {}):
                preview += 1
        if ev.get("type") == "step_finish":
            r = p.get("reason")
            finish[r] = finish.get(r, 0) + 1
    return {"tool_counts": tools, "tool_errors": errors, "preview_calls": preview,
            "subagent_calls": sum(v for k, v in tools.items() if str(k).lower() in ("subagent", "task", "agent")),
            "step_finish_reasons": finish,
            "error_events": sum(1 for ev in evs if ev.get("type") == "error")}


def pct(values, q):
    if not values:
        return None
    values = sorted(values)
    return round(values[min(len(values) - 1, int(q * len(values)))], 1)


def calls_summary(raw):
    f = raw / "calls.jsonl"
    calls = [json.loads(l) for l in f.read_text().splitlines()] if f.exists() else []
    chat = [c for c in calls if c.get("method") == "POST"]
    first = lambda c: c.get("t_first_choice_ms") if c.get("t_first_choice_ms") is not None else c.get("t_first_byte_ms")
    ttft = [first(c) for c in chat if first(c) is not None]
    decode = []
    for c in chat:
        u = c.get("usage") or {}
        out = u.get("completion_tokens")
        if out and c.get("t_end_ms") and first(c) is not None:
            secs = (c["t_end_ms"] - first(c)) / 1000
            if secs > 1:
                decode.append(out / secs)
    finish = {}
    for c in chat:
        for r in c.get("finish_reasons") or []:
            finish[r] = finish.get(r, 0) + 1
    statuses = {}
    for c in calls:
        statuses[str(c.get("status"))] = statuses.get(str(c.get("status")), 0) + 1
    providers = sorted({c["provider"] for c in chat if c.get("provider")})
    return {"calls": len(calls), "model_calls": len(chat), "statuses": statuses,
            "relay_errors": sum(1 for c in calls if c.get("relay_error")),
            "client_closed_early": sum(1 for c in calls if c.get("client_closed")),
            "cached_prompt_tokens": sum(int(((c.get("usage") or {}).get("prompt_tokens_details") or {}).get("cached_tokens") or 0) for c in chat),
            "prompt_tokens": sum(int((c.get("usage") or {}).get("prompt_tokens") or 0) for c in chat),
            "upstream_errors": sum(1 for c in chat if c.get("error")),
            "finish_reasons": finish, "truncated": finish.get("length", 0),
            "providers": providers,
            "ttft_ms_p50": pct(ttft, 0.5), "ttft_ms_p90": pct(ttft, 0.9),
            "decode_tps_p50": pct(decode, 0.5),
            "generation_ids": sum(len(c.get("ids") or []) for c in chat)}


def openrouter_generations(raw, rec, key):
    """OpenRouter's own record per call: provider, quantisation, cost."""
    f = raw / "calls.jsonl"
    if not f.exists():
        return None
    ids = [i for l in f.read_text().splitlines() for i in (json.loads(l).get("ids") or []) if i.startswith("gen-")]
    out, cost, providers = [], 0.0, {}
    for gid in ids:
        data = None
        for attempt in range(6):
            try:
                req = urllib.request.Request(f"https://openrouter.ai/api/v1/generation?id={gid}",
                                             headers={"Authorization": f"Bearer {key}"})
                with urllib.request.urlopen(req, timeout=30) as r:
                    data = json.load(r).get("data")
                break
            except Exception:
                time.sleep(5 * (attempt + 1))
        out.append({"id": gid, "data": data})
        if data:
            cost += float(data.get("total_cost") or 0)
            p = data.get("provider_name")
            providers[p] = providers.get(p, 0) + 1
    with open(rec / "generations.jsonl", "w") as g:
        for row in out:
            g.write(json.dumps(row) + "\n")
    return {"generations": len(ids), "found": sum(1 for r in out if r["data"]),
            "cost_usd": round(cost, 4), "providers": providers}


def code_stats(work):
    files = [p for p in work.rglob("*") if p.is_file()
             and p.relative_to(work).parts[0] not in ("vendor", ".preview")]
    lines = 0
    for p in files:
        try:
            lines += p.read_text().count("\n")
        except (UnicodeDecodeError, OSError):
            pass
    return {"files": len(files), "bytes": sum(p.stat().st_size for p in files), "lines": lines}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--setup", required=True)
    ap.add_argument("--brief", required=True)
    ap.add_argument("--sample", type=int, default=1)
    ap.add_argument("--lab", action="store_true", help="prompt-lab run: never published")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    setup = json.loads(Path(args.setup).read_text())
    # Local endpoints and machines stay out of the repository: a setup may
    # name environment variables for them (base_url_env, host_header_env,
    # host.ssh_env). The resolved values are used, not recorded.
    for key in ("base_url", "host_header"):
        if setup.get(f"{key}_env") and not setup.get(key):
            val = os.environ.get(setup[f"{key}_env"])
            if not val:
                sys.exit(f"{setup[key + '_env']} is not set")
            setup = {**setup, key: val}
    if setup.get("host", {}).get("ssh_env"):
        setup["host"] = {**setup["host"], "ssh": os.environ.get(setup["host"]["ssh_env"]) or sys.exit(f"{setup['host']['ssh_env']} is not set")}
    brief_meta, brief = read_brief(args.brief)
    key = os.environ.get(setup["api_key_env"])
    if not key:
        sys.exit(f"{setup['api_key_env']} is not set")
    vendor = HARNESS / "vendor" / f"three-{THREE_VERSION}"
    if not (vendor / "build").is_dir():
        sys.exit(f"missing {vendor}; run harness/fetch_vendor.sh")

    prompt_id = brief_meta.get("id") or Path(args.brief).stem
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_root = Path(args.out or (ROOT / ("lab" if args.lab else "runs"))).resolve()
    run = out_root / f"{stamp}-{prompt_id}-{setup['id']}-s{args.sample}"
    work, rec, inp = run / "workspace", run / "record", run / "input"
    raw = rec / "raw"
    for d in (raw, inp):
        d.mkdir(parents=True)
    shutil.copytree(HARNESS / "template", work)
    (work / "vendor" / "three").mkdir(parents=True)  # mount point
    (inp / "brief.md").write_text(brief)
    modes = [m.strip() for m in brief_meta.get("modes", "").split(",") if m.strip()]
    (inp / "check.json").write_text(json.dumps({"modes": modes, "mode_param": brief_meta.get("mode_param")}))

    tag = f"{stamp.lower()}-{os.getpid()}"
    name, relay = f"weightclass-run-{tag}", f"weightclass-relay-{tag}"
    up = urlsplit(setup["base_url"])
    max_steps = int(brief_meta.get("max_steps") or STEP_CAP_DEFAULT)
    max_tokens = int(brief_meta.get("max_tokens") or MAX_TOKENS)
    config = opencode_config(setup, f"http://{relay}:8080{up.path}", max_steps)
    (inp / "opencode.json").write_text(json.dumps(config, indent=1))

    ensure_network()
    uid = f"{os.getuid()}:{os.getgid()}"
    start_relay(relay, f"{up.scheme}://{up.netloc}", raw, uid, setup.get("host_header"))
    common = ["--user", uid, "--cap-drop", "ALL",
              "--security-opt", "no-new-privileges", "--pids-limit", "1024",
              "--memory", "8g", "--cpus", "4",
              "-v", f"{work}:/work", "-v", f"{vendor}:/work/vendor/three:ro"]
    agent_cmd = ["docker", "run", "--rm", "--name", name, "--network", NETWORK, *common,
                 "-e", "OPENCODE_CONFIG=/run/opencode.json", "-e", "WC_API_KEY",
                 # The live models.opencode.ai catalog changes request params
                 # (e.g. reasoning.summary) without a version change.
                 "-e", "OPENCODE_DISABLE_MODELS_FETCH=1",
                 "-v", f"{rec}:/out", "-v", f"{inp / 'brief.md'}:/run/brief.md:ro",
                 "-v", f"{inp / 'opencode.json'}:/run/opencode.json:ro",
                 IMAGE, "/opt/weightclass/entry.sh"]

    snapshots = Snapshots(work, rec / "history.git")
    guard = Guard(rec / "events.jsonl", raw / "calls.jsonl", name, snapshots, max_tokens)
    conc = Concurrency(run.name, f"{up.scheme}://{up.netloc}")
    host = Host(setup["host"], rec / "host") if setup.get("host") else None
    if host:
        host.start()
    t = threading.Thread(target=guard.run, daemon=True)
    stop_conc = threading.Event()

    def conc_loop():
        while not stop_conc.wait(SAMPLE_SECONDS):
            conc.sample()
    threading.Thread(target=conc_loop, daemon=True).start()

    started = time.time()
    print(f"run {run.name}: agent starting ({setup['id']})", flush=True)
    t.start()
    try:
        agent = subprocess.run(agent_cmd, env={**os.environ, "WC_API_KEY": key},
                               text=True, capture_output=True)
    finally:
        guard.stop.set()
        t.join(timeout=10)
        stop_conc.set()
        ended = time.time()
        (rec / "relay.log").write_text(sh("docker", "logs", relay, check=False).stderr)
        sh("docker", "rm", "-f", relay, check=False)
        host_summary = host.finish() if host else None
        concurrent = conc.close()
    snapshots.commit("final")
    wall = round(ended - started, 1)
    exit_code = (rec / "exit_code").read_text().strip() if (rec / "exit_code").exists() else None
    if guard.reason:
        end = guard.reason
    elif guard.steps >= max_steps:
        end = f"step cap ({max_steps})"
    elif exit_code == "0":
        end = "agent finished"
    else:
        end = f"agent exited {exit_code if exit_code is not None else agent.returncode}"
    if agent.stderr.strip():
        (rec / "docker.stderr").write_text(agent.stderr)

    print(f"run {run.name}: {end} after {wall}s; rendering", flush=True)
    sh("docker", "run", "--rm", "--network", "none", *common,
       "-v", f"{run}:/judged", IMAGE, "node", "/opt/weightclass/scene.mjs", "check", "/work", "/judged",
       check=False)
    checks = json.loads((run / "checks.json").read_text()) if (run / "checks.json").exists() else None

    evs = read_events(rec / "events.jsonl")
    generations = openrouter_generations(raw, rec, key) if up.hostname == "openrouter.ai" else None
    meta = {
        "run": run.name, "lab": args.lab,
        "prompt": {"id": prompt_id, "version": brief_meta.get("version"),
                   "variant": brief_meta.get("variant"), "subject": brief_meta.get("subject"),
                   "file": str(args.brief), "sha256": sha256_bytes(brief.encode())},
        "setup": json.loads(Path(args.setup).read_text()),
        "setup_sha256": sha256_bytes(Path(args.setup).read_bytes()),
        "sample": args.sample,
        "started": utc(started), "ended": utc(ended),
        "end_reason": end, "wall_seconds": wall,
        "concurrent_runs": concurrent,
        "tool_calls": guard.tool_calls, "tokens_seen": guard.tokens,
        # Headline totals: every model request (relay), sub-agents included.
        "tokens": raw_token_totals(raw) or token_totals(evs),
        "tokens_session": token_totals(evs),
        "agent": agent_summary(evs),
        "model_calls": calls_summary(raw),
        "openrouter": generations,
        "host": host_summary,
        "snapshots": snapshots.count,
        "code": code_stats(work),
        "workspace_sha256": sha256_tree(work),
        "harness": {
            **image_info(), "three": THREE_VERSION,
            "opencode_reported": (rec / "opencode_version.txt").read_text().strip()
            if (rec / "opencode_version.txt").exists() else None,
            "config_sha256": sha256_bytes(json.dumps(config, sort_keys=True).encode()),
            "template_sha256": sha256_tree(HARNESS / "template", skip=()),
            "scene_tool_sha256": sha256_bytes((HARNESS / "tools" / "scene.mjs").read_bytes()),
            "relay_sha256": sha256_bytes((HARNESS / "recorder" / "relay.py").read_bytes()),
            "guard": {"max_steps": max_steps, "max_tokens": max_tokens, "max_repeats": MAX_REPEATS},
        },
        "tier": "verified", "submitter": None,
        "rendered": checks.get("rendered") if checks else None,
    }
    (run / "meta.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps({"run": str(run), "end": end, "wall_seconds": wall,
                      "rendered": meta["rendered"], "tool_calls": guard.tool_calls}))


if __name__ == "__main__":
    main()
