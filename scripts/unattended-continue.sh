#!/bin/zsh
set -uo pipefail
cd /Users/saketamanana/applybot
mkdir -p data/outbox

bot_running() {
  pgrep -f "tsx scripts/outreach-bot.ts" >/dev/null 2>&1
}

while bot_running; do
  sleep 15
done

# Stop the Cursor-attached hourly wrapper so it cannot start another crawl.
for pid in $(pgrep -f "zsh scripts/hourly-outreach.sh" || true); do
  if [ "$pid" != "$$" ]; then
    kill "$pid" 2>/dev/null || true
  fi
done
sleep 2

if bot_running; then
  while bot_running; do sleep 15; done
  exec zsh scripts/hourly-outreach.sh 3
fi

exec zsh scripts/hourly-outreach.sh 2
