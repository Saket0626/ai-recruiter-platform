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
- [x] Implement personalized draft generation and quality gates (with remaining claim-strictness gaps).
- [x] Implement Google OAuth/token storage and Gmail MIME send (Outlook sending is disabled).
- [x] Implement dashboard, discovery progress, evidence views, queue edits/approval, history, settings.
- [x] Keep Review Mode default, `DRY_RUN=true`, `AUTO_SEND=false`, fail-closed malformed safety flags.
- [x] Add offline unit tests covering parsing, Graph payload, dry-run config, approval gate, cooldown math.
- [x] Run typecheck, lint, tests, and production build for this checkpoint (see `CHECKPOINT.md`).
- [x] Document install, Google Cloud/Gmail, Railway, and Supabase setup in README.

## Partially implemented

- [ ] SSRF defenses after DNS and on redirects (HTTP(S) fetch exists; private/metadata IP blocking is not implemented).
- [ ] Claim support checks: student-claim matching is still token/entity based and too loose for some sentences.
- [ ] Duplicate/rate reservations: SUBMITTING rows now reserve a draft and count toward the daily cap; concurrent unique index added. Recipient-level unique reservation is not complete.
- [ ] Resume hash/version bound to draft approval and attachment hashing.
- [ ] Hosted caller authorization: shared `APP_ACCESS_SECRET` gate, not per-user Microsoft session auth on every route.
- [ ] Autopilot fail-closed gates exist; concurrent autopilot send races still need stronger DB constraints.
- [ ] Playwright optional JS crawl exists behind `PLAYWRIGHT_ENABLED` but is untested in this checkpoint.
- [ ] Discovery robots.txt handling is incomplete.

## Not started or not verified

- [ ] Full concurrent rate-limit integration tests against Postgres.
- [ ] DNS-resolved SSRF tests and redirect revalidation.
- [ ] Live Graph send of a user-approved email (intentionally not done; `DRY_RUN` remains true).
- [ ] Resume PDF is not on Railway; live sending remains disabled there.

## User-dependent setup

- [ ] Supply the actual resume PDF locally; it is not in this repository.
- [ ] Confirm current student profile and availability.
- [ ] Configure model/search providers as needed.
- [ ] Register/configure Microsoft application, add the Railway redirect URI, and complete account-holder consent.
- [ ] Set `APP_ACCESS_SECRET` on Railway after this branch is deployed, then unlock the hosted UI.
- [ ] Review the first draft before intentionally enabling any real sending.

Do not mark a box complete merely because code was generated. Record verification evidence and blockers in `CHECKPOINT.md`.
