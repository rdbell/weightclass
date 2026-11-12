#!/bin/bash
# Runs inside the agent container: one OpenCode run on the brief, then the
# session export. /work is the workspace, /out the record, /run the inputs.
# HOME lives in the record, so OpenCode's own session store (its data,
# state and log directories) is kept with the run.
set -u
export HOME=/out/opencode-home
mkdir -p "$HOME"
cd /work || exit 1
opencode --version > /out/opencode_version.txt 2>&1
start=$(date +%s)
opencode run --standalone --auto --archived --format json --model weightclass/target \
  --title "weightclass" "$(cat /run/brief.md)" \
  > /out/events.jsonl 2> /out/opencode.stderr
echo $? > /out/exit_code
echo $(( $(date +%s) - start )) > /out/wall_seconds
session=$(grep -o -m1 '"sessionID":"[^"]*"' /out/events.jsonl | cut -d'"' -f4)
if [ -n "$session" ]; then
  echo "$session" > /out/session_id
  opencode session export --standalone "$session" > /out/session.json 2>> /out/opencode.stderr \
    || opencode session export "$session" > /out/session.json 2>> /out/opencode.stderr
fi
