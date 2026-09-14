# Shared agent instructions for Cursor and ChatGPT Astra

This repository is the shared source of truth for ResearchReach (`Saket0626/ai-recruiter-platform`).

- Pull before starting work.
- Do not overwrite uncommitted changes.
- Keep `DRY_RUN=true` and `AUTO_SEND=false` unless the user explicitly enables live sending.
- Never send real emails during automated testing.
- Never invent professor research or student experience.
- Never commit `.env`, `.env.local`, resumes, tokens, or database files.
- Never log access tokens, refresh tokens, client secrets, or API keys.
- Prefer official Gmail API and Google OAuth documentation for sending.
- After implementing, run tests, typecheck, lint, and production build.

Project constraints live in `.cursor/rules/`. Read `README.md` for setup, Google Cloud, Railway, and Supabase.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
