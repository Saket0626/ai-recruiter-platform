# ResearchReach checkpoint

Date: 2026-09-14

## Current implementation branch

`cursor/implementation-checkpoint`

Remote: https://github.com/Saket0626/ai-recruiter-platform

This checkpoint does **not** merge into `main`. Outlook/Graph is no longer the live sending path. Gmail is.

## Requirements completed (behavior checked in code/tests, not a live send)

| Requirement | Evidence |
| --- | --- |
| Seeded discovery, evidence storage, scoring, grounded drafts, Review Mode UI | Existing app under `lib/research`, `app/`, `components/` |
| Resume parsing and quality gates | `lib/resume`, `lib/validation/email-quality.ts` |
| Approval required before manual send; edits/regenerate revoke approval | `lib/email/send-gate.ts`, `lib/research/pipeline.ts`, `app/api/queue/[id]/route.ts`, `tests/send-gate.test.ts` |
| Fail-closed `DRY_RUN` / `AUTO_SEND` parsing | Cherry-picked from PR #2: `lib/config/env.ts`, `lib/db/settings.ts`, `tests/dry-run-config.test.ts` |
| Dry run does not count as a real contact and does not mark professor `SENT` | `lib/email/rate-limit.ts`, `professorStatusAfterSend` |
| Hosted access gate | `APP_ACCESS_SECRET`, `middleware.ts`, `/unlock`, `tests/access.test.ts` |
| `resume:generate` cannot overwrite `data/resume.pdf` | `scripts/generate-resume.ts` writes `data/fixtures/starter-resume.pdf` |
| Gmail send path with MIME PDF attachment | `lib/email/gmail-provider.ts`, `lib/email/mime.ts`, `tests/gmail.test.ts` |
| Google OAuth authorization-code + PKCE, `gmail.send` only, allowed sender `saket.amanana@gmail.com` | `lib/google/*`, `app/api/auth/google/*` |
| Provider selection is Gmail; no Outlook fallback | `lib/email/create-provider.ts`, pipeline uses `createEmailProvider()` |

## Requirements partially implemented

- Claim grounding is still looser than spec (`lib/resume/claims.ts` token/entity matching).
- SSRF: HTTP(S) fetch exists; no DNS/private/metadata IP blocking yet (`lib/search/seeded-crawler.ts`).
- Concurrent daily-cap/recipient reservations: draft-level `SUBMITTING` unique index exists; no full concurrent Postgres integration test.
- Resume hash is not bound to draft approval.
- Hosted auth is a shared app secret, not per-user Google session on every route.
- robots.txt handling is incomplete.

## Requirements not started / not verified live

- A real Gmail send (intentionally not done; `DRY_RUN` remains true).
- Google Cloud OAuth client credentials are not in the repo and are not on Railway yet.
- Resume PDF is still gitignored and not on Railway.
- DNS-resolved SSRF tests.

## Hosting already done (Railway + Supabase)

These are live from earlier work on `main`. This Gmail checkpoint is **not** deployed until this branch is merged or the Railway service is pointed at it.

**Supabase**

- Project: `ai-recruiter-platform`
- Ref: `vtrjwkinmmhsuomyfrri`
- Org: `ubkgnqxcoybgtcnxxvrh`
- Region: `us-west-1`
- Status: `ACTIVE_HEALTHY`
- App tables exist with RLS enabled; `anon`/`authenticated` have no grants on public tables (verified 2026-09-14).
- `_prisma_migrations` has RLS off; Data API roles have no grants, so it is not anonymously readable.
- Direct `db.vtrjwkinmmhsuomyfrri.supabase.co:5432` does not resolve on IPv4 locally; use the pooler:
  - `DATABASE_URL`: `aws-0-us-west-1.pooler.supabase.com:6543` with `sslmode=require&pgbouncer=true`
  - `DIRECT_URL`: pooler `:5432` for migrations
- New tables in this branch (`GoogleAuthAccount`, send reservation index) apply on `prisma migrate deploy` of this branch. They are not on production `main` yet.

**Railway**

- Project: `ai-recruiter-platform` (`1151058f-9547-4cec-80da-18a6814f4a28`)
- Service: `web` from GitHub `main`
- Live URL: https://web-production-3b016.up.railway.app (HTTP 200 after the pgbouncer/Docker fixes)
- `DRY_RUN=true`, `AUTO_SEND=false`
- Docker uses `npm install --ignore-scripts` in the deps stage because `npm ci` failed on Alpine/npm 10, and Prisma generate needs the schema copied first
- Resume PDF is not on Railway; sending stays disabled without it
- After this branch is deployed, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://<actual-host>/api/auth/google/callback`, `GOOGLE_ALLOWED_EMAIL=saket.amanana@gmail.com`, and `APP_ACCESS_SECRET`. Do not paste those values into GitHub.

## Known bugs and blockers

- Google Cloud OAuth client is not created yet. Connect Gmail cannot succeed until the user adds a Web client and env vars.
- External/Testing Gmail apps generally expire refresh tokens after 7 days until verification/publishing.
- Next.js 16 warns that `middleware.ts` should migrate to `proxy`; access gating still works.
- Optional Playwright crawl warns `Can't resolve 'playwright'` at build time; it is disabled unless `PLAYWRIGHT_ENABLED=true`.

## Validation commands

Ran 2026-09-14 on `cursor/implementation-checkpoint`:

```
npm test
```

Result: **10 files, 86 tests passed**. Includes `tests/dry-run-config.test.ts`, `tests/send-gate.test.ts`, `tests/gmail.test.ts`. No real email sent. Google/Gmail transport mocked.

```
npm run typecheck
```

Result: **passed** (`tsc --noEmit`).

```
npm run lint
```

Result: **passed** after unused-arg fix (0 errors).

```
npm run build
```

Result: **passed** (`next build`). Routes include `/api/auth/google` and `/api/auth/google/callback`. Playwright optional-import warning only.

Checks not run:

- Live Gmail `users.messages.send` (forbidden while `DRY_RUN=true` and during automated tests)
- `prisma migrate deploy` against production (this branch is not `main`)
- Browser click-through of Google consent (blocked until Google client credentials exist)

## Next subsystem

SSRF defenses and stricter resume/professor claim mappings, while ChatGPT reviews the Gmail OAuth/MIME work.

## Bounded tasks for ChatGPT

1. Review `lib/google/oauth.ts` and `app/api/auth/google/callback/route.ts` for one-use state, PKCE, ID-token audience/issuer/expiry/nonce, and wrong-account non-replacement.
2. Review `lib/email/mime.ts` + `tests/gmail.test.ts` for RFC 2822/base64url correctness. Suggest a tighter MIME parser only if the current decoder can miss a valid attachment we generate.
3. Do **not** switch sending back to Outlook. Do **not** request `gmail.readonly` / compose / full mailbox scopes.
4. If proposing a patch, keep it on a `codex/*` branch against this implementation, not `main`.
