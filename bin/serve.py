#!/usr/bin/env python3
"""Open a run's scene live on loopback, under the site's scene policy.

  bin/serve.py lab/<batch>/<run> [--port 8765]

Serves <run>/workspace with the pinned three.js at vendor/three, the same
Content-Security-Policy the render check uses (same-origin files only), on
127.0.0.1 only. Model-written code runs in your browser: open it in a
private window, not one signed in to anything.
"""
import argparse
import http.server
import sys
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
THREE = ROOT / "harness" / "vendor" / "three-0.187.0"
CSP = "; ".join([
    "default-src 'self' data: blob:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' data: blob:",
    "form-action 'none'",
    "frame-src 'none'",
])


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean.startswith("/vendor/three/"):
            target = (THREE / clean[len("/vendor/three/"):]).resolve()
            return str(target) if str(target).startswith(str(THREE)) else str(THREE / "_denied")
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("run")
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()
    work = Path(args.run).resolve() / "workspace"
    if not (work / "index.html").exists():
        sys.exit(f"no index.html in {work}")
    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=str(work)))
    print(f"http://127.0.0.1:{args.port}/index.html  (Ctrl-C to stop)")
    server.serve_forever()


if __name__ == "__main__":
    main()
