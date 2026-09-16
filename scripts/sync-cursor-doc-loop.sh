#!/bin/zsh
set -uo pipefail
cd /Users/saketamanana/applybot
end=$(( $(date +%s) + 36000 ))
while [ "$(date +%s)" -lt "$end" ]; do
  node --import ./scripts/register-cli-hooks.mjs --import tsx scripts/sync-cursor-doc.ts || true
  sleep 20
done
