"""Recording relay: the agent container's only network exit, one per run.

OpenCode talks plain HTTP to this relay; the relay forwards every request
to one upstream origin (WC_UPSTREAM, e.g. https://openrouter.ai or
http://10.0.0.5:8000) and nowhere else. Every exchange is recorded under
/raw (mounted from the run's record directory):

  calls.jsonl        one line per call: timing, status, sizes, generation
                     ids, provider, finish reasons, usage (last seen)
  NNNN.req.json.gz   request: method, path, headers (credentials redacted),
                     body exactly as sent
  NNNN.resp.jsonl.gz response: status and headers, then every body chunk
                     with its arrival time in ms since the request started

Streaming responses are passed through chunk by chunk, so the agent sees
the same timing as without the relay.
"""
import gzip
import socket
import http.client
import itertools
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

UP = urlsplit(os.environ["WC_UPSTREAM"])
RAW = os.environ.get("WC_RAW", "/raw")
PORT = int(os.environ.get("WC_RELAY_PORT", "8080"))
REDACT = {"authorization", "x-api-key", "api-key", "cookie", "proxy-authorization"}
HOP = {"host", "content-length", "connection", "keep-alive", "proxy-connection",
       "transfer-encoding", "te", "upgrade", "accept-encoding"}
counter = itertools.count(1)
lock = threading.Lock()


def log(*parts):
    print(*parts, flush=True, file=sys.stderr)


def summarise(chunks):
    """Pull ids, provider, finish reasons and usage out of an SSE or JSON body."""
    text = b"".join(chunks).decode("utf-8", "replace")
    docs = []
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("data:"):
            line = line[5:].strip()
        if line.startswith("{"):
            try:
                docs.append(json.loads(line))
            except ValueError:
                pass
    if not docs:
        try:
            docs.append(json.loads(text))
        except ValueError:
            pass
    finish = {}
    out = {"ids": [], "provider": None, "model": None, "finish_reasons": [], "usage": None, "error": None}
    for d in docs:
        if not isinstance(d, dict):
            continue
        if d.get("id") and d["id"] not in out["ids"]:
            out["ids"].append(d["id"])
        out["provider"] = d.get("provider") or out["provider"]
        out["model"] = d.get("model") or out["model"]
        if d.get("usage"):
            out["usage"] = d["usage"]
        if d.get("error"):
            out["error"] = d["error"]
        for c in d.get("choices") or []:
            if isinstance(c, dict) and c.get("finish_reason"):
                finish[c.get("index", 0)] = c["finish_reason"]
    out["finish_reasons"] = [finish[k] for k in sorted(finish)]
    return out


class Relay(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def do_GET(self):
        self.forward()

    def do_POST(self):
        self.forward()

    def forward(self):
        n = next(counter)
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        t0 = time.time()
        req_headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP}
        req_headers["Host"] = os.environ.get("WC_HOST_HEADER") or UP.netloc
        req_headers["Accept-Encoding"] = "identity"
        with gzip.open(f"{RAW}/{n:04d}.req.json.gz", "wt") as f:
            json.dump({"n": n, "t_start": t0, "method": self.command, "path": self.path,
                       "headers": {k: ("<redacted>" if k.lower() in REDACT else v) for k, v in req_headers.items()},
                       "body": body.decode("utf-8", "replace")}, f)
        cls = http.client.HTTPSConnection if UP.scheme == "https" else http.client.HTTPConnection
        rec = {"n": n, "t_start": t0, "method": self.command, "path": self.path,
               "req_bytes": len(body), "status": None, "t_first_byte_ms": None,
               "t_first_choice_ms": None, "client_closed": False,
               "t_end_ms": None, "resp_bytes": 0, "relay_error": None}
        chunks = []
        try:
            conn = cls(UP.hostname, UP.port, timeout=3600)
            conn.request(self.command, self.path, body, req_headers)
            resp = conn.getresponse()
            rec["status"] = resp.status
            self.send_response(resp.status)
            headers = resp.getheaders()
            for k, v in headers:
                if k.lower() not in HOP and k.lower() != "content-encoding":
                    self.send_header(k, v)
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            with gzip.open(f"{RAW}/{n:04d}.resp.jsonl.gz", "wt") as f:
                f.write(json.dumps({"status": resp.status, "headers": headers}) + "\n")
                while True:
                    chunk = resp.read1(65536)
                    if not chunk:
                        break
                    ms = round((time.time() - t0) * 1000, 1)
                    if rec["t_first_byte_ms"] is None:
                        rec["t_first_byte_ms"] = ms
                    # Hosted APIs send keep-alive comments first; the first
                    # chunk with choices is the model's first token.
                    if rec["t_first_choice_ms"] is None and b'"choices"' in chunk:
                        rec["t_first_choice_ms"] = ms
                    rec["resp_bytes"] += len(chunk)
                    chunks.append(chunk)
                    f.write(json.dumps({"t": ms, "d": chunk.decode("utf-8", "replace")}) + "\n")
                    if not rec["client_closed"]:
                        try:
                            self.wfile.write(b"%x\r\n%s\r\n" % (len(chunk), chunk))
                            self.wfile.flush()
                        except OSError:
                            # The agent may close once it has [DONE]; keep
                            # recording whatever upstream still sends.
                            rec["client_closed"] = True
            if not rec["client_closed"]:
                try:
                    self.wfile.write(b"0\r\n\r\n")
                    self.wfile.flush()
                except OSError:
                    rec["client_closed"] = True
        except Exception as exc:  # upstream or client failure: record it
            rec["relay_error"] = repr(exc)[:500]
            log("call", n, "failed:", exc)
            if rec["status"] is None:
                try:
                    self.send_response(502)
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                except Exception:
                    pass
            # A streamed 200 has already committed its headers. Do not leave
            # the client waiting forever for the missing chunk terminator, or
            # send a success terminator for a truncated model response.
            self.close_connection = True
            try:
                self.connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
        rec["t_end_ms"] = round((time.time() - t0) * 1000, 1)
        rec.update(summarise(chunks))
        with lock, open(f"{RAW}/calls.jsonl", "a") as f:
            f.write(json.dumps(rec) + "\n")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Relay)
    server.daemon_threads = True
    log(f"relay on {PORT} for {UP.scheme}://{UP.netloc}")
    server.serve_forever()
