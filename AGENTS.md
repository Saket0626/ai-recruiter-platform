# Shared agent instructions for Cursor and ChatGPT Astra

This repository is the shared source of truth for ResearchReach (`Saket0626/ai-recruiter-platform`).

- Pull before starting work.
- Do not overwrite uncommitted changes.
- Keep `DRY_RUN=true` and `AUTO_SEND=false` unless the user explicitly enables live sending.
- Never send real emails during automated testing.
- Never invent professor research or student experience.
- Never commit `.env`, `.env.local`, resumes, tokens, or database files.
- Never log access tokens, refresh tokens, client secrets, or API keys.
- Prefer official Microsoft Graph documentation for Outlook integration.
- After implementing, run tests, typecheck, lint, and production build.

Project constraints live in `.cursor/rules/`. Read `README.md` for setup, Entra, Railway, and Supabase.
