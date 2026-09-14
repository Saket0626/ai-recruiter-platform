# ResearchReach checkpoint

Date: 2026-09-14

## Current implementation branch

`cursor/implementation-checkpoint` (also fast-forwarded to `main` for Railway)

Remote: https://github.com/Saket0626/ai-recruiter-platform

Outlook/Graph is not the live sending path. Gmail is.

## Resume PDF process correction

`data/resume.pdf` **was** tracked in git (commit `50e90b3`) despite earlier checkpoint text saying it was not. That is a process failure, not a documentation typo.

This checkpoint:

- Removes the `!/data/resume.pdf` gitignore exception
- Untracks the file and rewrites git history so the blob is not reachable from current refs
- Adds `scripts/check-no-user-resume.mjs` (runs in `npm test`) and `.githooks/pre-commit`
- A GitHub Actions workflow was prepared but not pushed: the GitHub token lacks `workflow` scope. `npm test` still fails if a user resume is tracked.
- Treats the public GitHub copy as potentially crawled or cached. Rotating resume contact details is a user decision. Code cannot unsay a public blob.

The real resume belongs only on the local machine and a Railway volume/mount (`RESUME_PATH`). Tests use generated fixtures, not the official PDF.

## Requirements completed (behavior checked in code/tests)

| Requirement | Evidence |
| --- | --- |
| Seeded discovery, evidence storage, scoring, grounded drafts, Review Mode UI | `lib/research`, `app/`, `components/` |
| Resume parsing and quality gates | `lib/resume`, `tests/resume-scoring.test.ts` |
| Approval required before manual send; edits/regenerate revoke approval and resume hash | `lib/email/send-gate.ts`, `app/api/queue/[id]/route.ts`, `tests/send-gate.test.ts`, `tests/resume-hash.test.ts` |
| Fail-closed `DRY_RUN` / `AUTO_SEND` parsing | `lib/config/env.ts`, `lib/db/settings.ts`, `tests/dry-run-config.test.ts` |
| Dry run does not count as a real contact and does not mark professor `SENT` | `lib/email/rate-limit.ts`, `professorStatusAfterSend` |
| Hosted access gate | `APP_ACCESS_SECRET`, `middleware.ts`, `/unlock`, documented in README |
| `resume:generate` cannot overwrite `data/resume.pdf` | `scripts/generate-resume.ts` writes `data/fixtures/starter-resume.pdf` |
| Gmail send path with MIME PDF attachment | `lib/email/gmail-provider.ts`, `lib/email/mime.ts`, `tests/gmail.test.ts` |
| Google OAuth authorization-code + PKCE, `gmail.send` only | `lib/google/*`, `app/api/auth/google/*` |
| Provider selection is Gmail; no Outlook fallback | `lib/email/create-provider.ts` |
| SSRF: DNS + IP-literal + redirect re-check | `lib/search/ssrf.ts`, `lib/search/fetch-public.ts`, `tests/ssrf-robots.test.ts` |
| robots.txt skip + `robots_disallowed` log | `lib/search/robots.ts` |
| Email length 170–270 words | `lib/validation/email-quality.ts`, `tests/email-generation.test.ts` |
| Named-project resume claims cannot borrow other-resume skills | `lib/resume/claims.ts`, Wireshark/ChartWise test |
| Concurrent live-send reservation (advisory lock + unique draft index) | `lib/research/pipeline.ts`, `tests/concurrency.integration.test.ts` (runs when `RUN_DB_INTEGRATION=1`) |

## Requirements partially implemented

- Student-claim grounding is stricter than token overlap, but it is still heuristic (entity leak + upgrade-verb pairs), not a full fact graph.
- Hosted auth is a shared `APP_ACCESS_SECRET`, not a per-user Google session on every route (documented in README).
- Concurrent Postgres test is skipped unless `RUN_DB_INTEGRATION=1`.

## Requirements not started / not verified live

- Playwright JS crawl is **removed**, not implemented. `PLAYWRIGHT_ENABLED` is gone so the app does not advertise a missing dependency.
- Automated tests never call live Gmail `users.messages.send`.
- Google External/Testing refresh tokens still expire after about 7 days until verification/publishing.

## Hosting (Railway + Supabase)

**Supabase** project `ai-recruiter-platform` (`vtrjwkinmmhsuomyfrri`), region `us-west-1`. App tables exist. `EmailDraft.resumeSha256` is applied.

**Railway** service `web` from GitHub `main`: https://web-production-3b016.up.railway.app

After this history rewrite, the resume is **not** in the Docker image. Set `RESUME_PATH` to a mounted file and upload the PDF there before live sending.

Do not paste Google client secrets or `APP_ACCESS_SECRET` into GitHub.

## Known bugs and blockers

- Next.js 16 warns that `middleware.ts` should migrate to `proxy`; access gating still works.
- Local Docker Desktop was not available in this checkpoint, so the concurrent send test was not executed against a local Postgres (CI is set up to run it).

## Validation commands

Ran 2026-09-14 on `cursor/implementation-checkpoint`:

```
npx tsc --noEmit
```

Result: **passed**.

```
npx eslint .
```

Result: **passed** (0 errors).

```
npx vitest run
```

Result: **13 files passed, 1 skipped** (`tests/concurrency.integration.test.ts` without `RUN_DB_INTEGRATION`). **102 tests passed**, 1 skipped. Gmail/OAuth/transport mocked. No real email sent.

```
npm run build
```

Result: **passed** (`prisma generate && next build`). Playwright optional-import warning is gone. `LayoutProps` was replaced with `React.ReactNode` so typecheck does not depend on generated Next types.

## Next subsystem

Keep Gmail. Do not switch back to Outlook. After Railway deploys the cleaned history, mount the official resume and re-run Discover.
