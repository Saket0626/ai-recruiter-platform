# Implementation plan

This file is a requirements checklist against the running ResearchReach app, not a claim that the application is unimplemented. Verification evidence lives in `CHECKPOINT.md`.

## Completed and verified in this checkpoint

- [x] Initialize the existing private repository as ResearchReach.
- [x] Save specification, persistent agent rules, prompt templates, and environment template.
- [x] Record current resume corrections and safe installation defaults.
- [x] Inspect repository, select compatible stable dependencies, initialize application and lockfile.
- [x] Set up configuration validation, secret handling, and isolated provider interfaces.
- [x] Implement Prisma models, migrations, transactions, and core state transitions (Postgres / Supabase).
- [x] Implement local resume parsing, source facts, and attachment presence checks.
- [x] Implement seeded crawling plus configurable search, caching, and crawl delay.
- [x] Implement faculty extraction, evidence storage, grounded structured analysis, relevance scoring.
- [x] Implement personalized draft generation and quality gates.
- [x] Implement Google OAuth/token storage and Gmail MIME send (Outlook sending is disabled).
- [x] Implement dashboard, discovery progress, evidence views, queue edits/approval, history, settings.
- [x] Keep Review Mode default, `DRY_RUN=true`, `AUTO_SEND=false`, fail-closed malformed safety flags.
- [x] Add offline unit tests covering parsing, Gmail MIME, dry-run config, approval gate, cooldown math, SSRF, robots, resume hash.
- [x] Run typecheck, lint, tests, and production build for this checkpoint (see `CHECKPOINT.md`).
- [x] Document install, Google Cloud/Gmail, Railway, unlock gate, and Supabase setup in README.
- [x] SSRF defenses after DNS and on redirects.
- [x] robots.txt fetch/parse/cache and skip disallowed URLs.
- [x] Bind draft approval to SHA-256 of the current resume PDF.
- [x] Tighten named-project resume claims so they cannot borrow unrelated skills.
- [x] Narrow email quality-gate length to 170–270 words.
- [x] Remove advertised Playwright crawl (dependency was never installed).
- [x] Stop tracking `data/resume.pdf` and add a CI/test check so it cannot be committed again.

## Partially implemented

- [ ] Student-claim matching is entity-leak + upgrade-verb based, not a full per-fact mapping.
- [ ] Hosted caller authorization: shared `APP_ACCESS_SECRET` gate, not per-user Google session auth on every route (documented choice).
- [ ] Concurrent autopilot/live-send race: advisory lock + unique draft index exist; integration test requires `RUN_DB_INTEGRATION=1`.

## Not started or not verified

- [ ] Live Gmail send in automated tests (forbidden).
- [ ] Official resume file on Railway after git-history cleanup (must be mounted by the operator).

## User-dependent setup

- [ ] Keep the official resume on disk locally at `data/resume.pdf` (gitignored) and mount it on Railway.
- [ ] Confirm current student profile and availability.
- [ ] Configure model/search providers as needed.
- [ ] Keep the Google Cloud OAuth client and Gmail API enabled; reconnect when the 7-day testing token expires.
- [ ] Review drafts before leaving live sending enabled.

Do not mark a box complete merely because code was generated. Record verification evidence and blockers in `CHECKPOINT.md`.
