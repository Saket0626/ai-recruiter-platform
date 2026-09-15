#!/bin/sh
set -eu
VOLUME="/app/resume-data/resume.pdf"
DATA="/app/data/resume.pdf"
mkdir -p /app/resume-data /app/data || true
if [ -f "$VOLUME" ]; then
  cp "$VOLUME" "$DATA" || true
fi
if [ -f "$DATA" ] && [ ! -f "$VOLUME" ]; then
  cp "$DATA" "$VOLUME" || true
fi
./node_modules/.bin/prisma migrate deploy
exec node server.js
