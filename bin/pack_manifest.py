#!/usr/bin/env python3
"""Write a pack's file manifest (name, size, SHA-256 per file) for setups.

The fleet's source of truth already pins every pack file's hash:
command-center's host_vars (entries with repo, revision, files) or a
Kapitsa manifest file. This copies that list into packs/<slug>.json with a
hash of the whole list, which a setup references as pack.manifest_sha256.

  bin/pack_manifest.py --repo Jundot/GLM-5.3-Flash-oQ4e-mtp \
      --revision 9e5c75a9... [--host-vars PATH]
  bin/pack_manifest.py --kapitsa-manifest PATH --repo NAME --revision LABEL

Optional on-machine check (read-only; hashes every file, minutes per
100 GB):  --verify-ssh m3ultra256 --verify-dir /path/to/pack
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CC = Path.home() / "Work/src/github.com/rdbell/command-center"
DEFAULT_HOST_VARS = CC / "ansible/inventory/host_vars/m3ultra256.yml"


def find_entry(tree, repo, revision):
    if isinstance(tree, dict):
        if tree.get("repo") == repo and str(tree.get("revision")) == revision and tree.get("files"):
            return tree
        for v in tree.values():
            hit = find_entry(v, repo, revision)
            if hit:
                return hit
    elif isinstance(tree, list):
        for v in tree:
            hit = find_entry(v, repo, revision)
            if hit:
                return hit
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--revision", required=True)
    ap.add_argument("--host-vars", default=str(DEFAULT_HOST_VARS))
    ap.add_argument("--kapitsa-manifest")
    ap.add_argument("--verify-ssh")
    ap.add_argument("--verify-dir")
    args = ap.parse_args()

    if args.kapitsa_manifest:
        files = json.loads(Path(args.kapitsa_manifest).read_text())["files"]
        source = "kapitsa manifest " + re.sub(r".*/command-center/", "rdbell/command-center:", str(args.kapitsa_manifest))
    else:
        entry = find_entry(yaml.safe_load(Path(args.host_vars).read_text()), args.repo, args.revision)
        if not entry:
            sys.exit(f"{args.repo}@{args.revision} with a files list is not in {args.host_vars}")
        files = entry["files"]
        source = "host_vars " + re.sub(r".*/command-center/", "rdbell/command-center:", str(args.host_vars))
    files = sorted(({"name": f["name"], "size": f.get("size"), "sha256": f["sha256"]} for f in files),
                   key=lambda f: f["name"])
    listing = json.dumps(files, sort_keys=True).encode()
    out = {"repo": args.repo, "revision": args.revision, "source": source,
           "files": files, "total_bytes": sum(f["size"] or 0 for f in files),
           "manifest_sha256": hashlib.sha256(listing).hexdigest(), "verified_on": None}

    if args.verify_ssh and args.verify_dir:
        script = f"cd {json.dumps(args.verify_dir)} && " + " && ".join(
            f"shasum -a 256 {json.dumps(f['name'])}" for f in files)
        res = subprocess.run(["ssh", "-o", "BatchMode=yes", args.verify_ssh, script],
                             text=True, capture_output=True)
        got = {}
        for line in res.stdout.splitlines():
            h, _, name = line.partition("  ")
            got[name.strip()] = h
        bad = [f["name"] for f in files if got.get(f["name"]) != f["sha256"]]
        if bad:
            sys.exit(f"verification failed for {len(bad)} file(s): {bad[:5]}")
        out["verified_on"] = {"host": args.verify_ssh, "dir": args.verify_dir}

    slug = re.sub(r"[^A-Za-z0-9._-]+", "_", f"{args.repo}@{args.revision[:12]}")
    path = ROOT / "packs" / f"{slug}.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(out, indent=1) + "\n")
    print(f"{path}  {len(files)} files, {out['total_bytes'] / 1e9:.1f} GB, manifest {out['manifest_sha256'][:16]}")


if __name__ == "__main__":
    main()
