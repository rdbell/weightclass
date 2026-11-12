# One image for the agent run and the judged render: OpenCode, Chromium
# (Playwright's image) and our scene tool. Versions are pinned at build time;
# bin/run.py records them in every result's harness fingerprint.
# Latest releases by decision (2026-11-11): the fleet's 20-day npm
# release-age policy is overridden for this image only (exact versions,
# recorded per result, network-confined agent).
ARG PLAYWRIGHT_VERSION=1.65.0
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
ARG PLAYWRIGHT_VERSION
ARG OPENCODE_VERSION=2.2.7
ARG PNGJS_VERSION=7.0.0
WORKDIR /opt/weightclass
# OpenCode's glob/grep use ripgrep; without it they try to download it from
# GitHub, which the agent's network does not allow.
RUN apt-get update && apt-get install -y --no-install-recommends ripgrep \
 && rm -rf /var/lib/apt/lists/*
RUN npm config set min-release-age 0 \
 && npm install --omit=dev --no-audit --no-fund \
      playwright@${PLAYWRIGHT_VERSION} pngjs@${PNGJS_VERSION} \
 && npm install -g --no-audit --no-fund @opencode/cli@${OPENCODE_VERSION} \
 && opencode --version
COPY tools/scene.mjs entry.sh /opt/weightclass/
RUN chmod 0755 /opt/weightclass/entry.sh \
 && printf '#!/bin/sh\nexec node /opt/weightclass/scene.mjs preview "${1:-.}"\n' > /usr/local/bin/preview \
 && chmod 0755 /usr/local/bin/preview
LABEL org.weightclass.opencode=${OPENCODE_VERSION} org.weightclass.playwright=${PLAYWRIGHT_VERSION}
USER pwuser
