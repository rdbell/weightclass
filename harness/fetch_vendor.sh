#!/bin/bash
# Fetch the pinned three.js into harness/vendor/three-<version>/ (git-ignored),
# checking npm's published integrity hash. Workspaces mount it read-only as
# vendor/three. Only build/ and examples/jsm/ are kept.
set -euo pipefail
version=${1:-0.186.1}
here=$(cd "$(dirname "$0")" && pwd)
dest="$here/vendor/three-$version"
[ -d "$dest/build" ] && { echo "$dest already present"; exit 0; }
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
meta=$(curl -fsS "https://registry.npmjs.org/three/$version")
url=$(jq -r .dist.tarball <<<"$meta")
want=$(jq -r .dist.integrity <<<"$meta")
curl -fsS -o "$tmp/three.tgz" "$url"
got="sha512-$(openssl dgst -sha512 -binary "$tmp/three.tgz" | base64 -w0)"
[ "$got" = "$want" ] || { echo "integrity mismatch for three@$version" >&2; exit 1; }
tar -xzf "$tmp/three.tgz" -C "$tmp" package/build package/examples/jsm package/LICENSE
mkdir -p "$dest"
mv "$tmp/package/build" "$tmp/package/LICENSE" "$dest/"
mkdir -p "$dest/examples" && mv "$tmp/package/examples/jsm" "$dest/examples/"
echo "three@$version -> $dest"
