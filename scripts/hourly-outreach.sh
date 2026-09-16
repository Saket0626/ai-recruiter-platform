#!/bin/zsh
set -uo pipefail
cd /Users/saketamanana/applybot
mkdir -p data/outbox

bot_running() {
  pgrep -f "tsx scripts/outreach-bot.ts" >/dev/null 2>&1
}

wait_for_bot() {
  while bot_running; do
    sleep 20
  done
}

completed="${1:-}"
if [ -z "$completed" ]; then
  completed="$(cat data/outbox/hourly-run-count.txt 2>/dev/null || echo 1)"
fi

echo "Unattended outreach: last completed hour=${completed}. No Google Doc. Writing ~/.cursor/outreach-drafts.txt"

wait_for_bot

for n in {$((completed + 1))..10}; do
  echo "$n" > data/outbox/hourly-run-count.txt
  start=$(date +%s)
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) starting hour ${n} of 10"
  if bot_running; then
    wait_for_bot
  else
    npm run bot -- --colleges=40 || echo "hour ${n} bot exited nonzero"
  fi
  node --import ./scripts/register-cli-hooks.mjs --import tsx scripts/sync-cursor-doc.ts || true
  echo "$n" > data/outbox/hourly-run-count.txt
  elapsed=$(( $(date +%s) - start ))
  remain=$(( 3600 - elapsed ))
  echo "hour ${n} finished in ${elapsed}s"
  if [ "$n" -lt 10 ] && [ "$remain" -gt 0 ]; then
    echo "sleeping ${remain}s until the next hour"
    sleep "$remain"
  fi
done

echo "Finished 10 hourly 40-college runs."
