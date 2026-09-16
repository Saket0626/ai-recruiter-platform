#!/bin/zsh
set -euo pipefail
cd /Users/saketamanana/applybot

bot_running() {
  pgrep -f "tsx scripts/outreach-bot.ts" >/dev/null 2>&1
}

wait_for_bot() {
  while bot_running; do
    sleep 20
  done
}

echo "HOUR 1 is the live crawl. Waiting for it to finish before hours 2-10."
wait_for_bot

for n in {2..10}; do
  start=$(date +%s)
  echo "AGENT_LOOP_TICK_hourly_bot starting hour ${n} of 10 at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if bot_running; then
    echo "hour ${n}: crawl already running, waiting"
    wait_for_bot
  else
    npm run bot -- --colleges=40
  fi
  node --import ./scripts/register-cli-hooks.mjs --import tsx scripts/sync-cursor-doc.ts || true
  elapsed=$(( $(date +%s) - start ))
  remain=$(( 3600 - elapsed ))
  echo "hour ${n} finished in ${elapsed}s"
  if [ "$n" -lt 10 ] && [ "$remain" -gt 0 ]; then
    echo "sleeping ${remain}s until the next hour"
    sleep "$remain"
  fi
done

echo "Finished 10 hourly 40-college runs."
