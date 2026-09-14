# Requirements compliance

Audit of the existing ResearchReach codebase (not a rewrite). Sending is **Gmail + Postgres**, which supersedes the original Outlook/Graph + SQLite wording. Items marked N/A under Microsoft Graph are implemented on the Gmail provider instead.

Status: **Implemented** / **Partial** / **Missing** / **Superseded**.

## 1. Access gate

**Implemented.** `middleware.ts` redirects unauthenticated browser routes to `/unlock?next=...` when `APP_ACCESS_SECRET` is set. Production with an empty secret is refused. This is a real shared-operator gate protecting a Gmail-connected mailbox, not a Microsoft login placeholder. Documented in `README.md` (Access gate). Dashboard, Discover, Professors, Queue, Sent, and Settings are server components that query Prisma (`app/page.tsx`, `app/queue/page.tsx`, and siblings). The only “Loading…” is a `Suspense` fallback around the unlock form (`app/unlock/page.tsx`).

## 2. Anti-hallucination grounding (professor side)

**Implemented.** Evidence rows require a URL (`prisma/schema.prisma` `ResearchEvidence`). Insufficient pages set `insufficient_evidence` in `lib/llm/deterministic.ts` and `lib/research/analyzer.ts`; pipeline marks `INSUFFICIENT_EVIDENCE` and `validateEmailDraft` blocks generation/send (`insufficient_evidence` in `lib/validation/email-quality.ts`). Prompt `prompts/professor-analysis.md` forbids prior knowledge and requires `insufficient_evidence=true`. Retrieved pages are wrapped with `wrapUntrustedData` (`lib/security/prompt-injection.ts`). Prompt-injection fixture is in `tests/email-generation.test.ts` and `tests/graph-and-security.test.ts`.

## 3. Anti-hallucination grounding (student side)

**Implemented / Partial.** `isResumeSupportedClaim` in `lib/resume/claims.ts` runs from `validateEmailDraft` before queueing. Helped-vs-built is tested in `tests/resume-scoring.test.ts`. Named-project claims cannot borrow other-resume skills (Wireshark + ChartWise). Missing `RESUME_PATH` fails closed in `lib/resume/service.ts` (`resumeExists` / `loadStudentProfile`) and quality gate `missing_resume`. Remaining gap: matching is still heuristic, not a per-fact ID graph.

## 4. Security

**Implemented (Gmail, not Graph).** No hardcoded Microsoft/LLM/search secrets (repo grep). `.env` is gitignored. Logger redacts `token`/`secret`/`api_key` keys (`lib/logging/logger.ts`). Gmail scopes are `openid`, `email`, and `gmail.send` only (`lib/google/scopes.ts`). Original Graph `Mail.Send` path is unused (`lib/email/create-provider.ts` requires `gmail`).

## 5. Sending controls

**Implemented.** Defaults: `DRY_RUN=true`, `AUTO_SEND=false` in `.env.example` and `lib/config/env.ts`. Manual send requires `APPROVED` (`lib/email/send-gate.ts`). Autopilot requires Settings `AUTO_SEND`, score ≥ `AUTOPILOT_MIN_SCORE`, quality gate, faculty email, resume, cooldown, daily cap, evidence, generic-inbox block, no placeholders (`lib/research/pipeline.ts` + `validateEmailDraft`). Generic inboxes tested in `tests/parsing.test.ts` / `tests/email-generation.test.ts`.

## 6. Rate limiting, cooldown, duplicate prevention

**Implemented / Partial.** `MAX_EMAILS_PER_DAY` (15) and `PROFESSOR_COOLDOWN_DAYS` (90) are enforced in `lib/email/rate-limit.ts` against `EmailSend`. Emails are `normalizeEmail` (lowercase/trim) before duplicate/cooldown checks (`lib/security/email.ts`). Identity also keys on faculty URL and university+name (`identityKey`). Unique partial index `EmailSend_draftId_inflight_key` plus `pg_advisory_xact_lock` in `sendApprovedDraft`. Concurrent integration test exists but skips without `RUN_DB_INTEGRATION=1`.

## 7. Search / discovery / crawling

**Implemented.** `SearchProvider` in `lib/search/provider.ts`; `SeededCrawlerSearchProvider` works with `SEARCH_API_KEY` unset (`lib/search/composite.ts`). Crawl delay and `USER_AGENT` (`lib/config/defaults.ts`, `lib/research/page-cache.ts`). Page cache in `PageCache`. Untrusted-data wrapper + passing injection tests. robots.txt parsed/cached; disallowed URLs log `robots_disallowed` and skip (`lib/search/robots.ts`). SSRF rejects loopback/private/metadata IPs before fetch and on redirects (`lib/search/ssrf.ts`, `tests/ssrf-robots.test.ts`).

## 8. Relevance scoring

**Implemented.** Caps 40 / 30 / 20 / 10 in `lib/research/scorer.ts`. Default threshold 65 (`MIN_RELEVANCE_SCORE`) enforced before email generation in the pipeline. Department-only pages do not qualify (`tests/resume-scoring.test.ts`). `scoringFactors` and `relevanceExplanation` stored on `Professor`.

## 9. Email generation and quality gate

**Implemented.** `validateEmailDraft` (`lib/validation/email-quality.ts`) independently checks: valid email, generic inbox, resume present, sufficient evidence, score, topics, professor name, attached-resume sentence, placeholders, URLs, style, length 170–270, subject style, banned LLM phrases, evidence-backed topics, quoted titles, other professors, student claims, personalization, retrieved research detail. Field-specific second paragraphs in `lib/email/generator.ts` (`pickWork`). Subjects are calm and specific (`styleFailures` / `bad_subject`). Duplicate recipient is a send-time check (`isInCooldown` / reservation), not the quality-gate list.

## 10. Microsoft Graph sending

**Superseded by Gmail.** `createEmailProvider()` only constructs `GmailEmailProvider`. MIME PDF attach at send time (`lib/email/mime.ts`, `lib/email/gmail-provider.ts`); missing file blocks send. 401/403/429 mapped in `gmailErrorMessage`. Residual Graph helpers remain in `lib/microsoft/graph.ts` for older tests and are not the live path.

## 11. Database and dashboard

**Implemented (Postgres, not SQLite).** Prisma models: Professor, ResearchEvidence, EmailDraft (including `resumeSha256`), EmailSend, AppSetting, DiscoveryRun, plus PageCache and GoogleAuthAccount. Dashboard pages query Prisma. Review Queue shows evidence beside drafts (`app/queue/page.tsx`). Approve / Reject / Regenerate / Send mutate the database (`app/api/queue/[id]/route.ts`).

## 12. Testing

**Implemented / Partial.** `npx vitest run` on 2026-09-14: **102 passed**, 1 skipped (concurrency without local Postgres). Coverage includes parsing, email extraction, URL normalization, scoring, Zod, resume presence/parsing, quality gate, daily cap math, cooldown math, generic inboxes, Gmail MIME (not live send), prompt injection. Graph request tests still exist as legacy payload tests. Concurrent unique-index test is present and CI-wired. No test sends real email (Gmail mocked in `tests/gmail.test.ts`). Insufficient-evidence and no-research-match professors receive no sendable draft (`tests/email-generation.test.ts`, `tests/resume-scoring.test.ts`).

## 13. Cursor rules

**Implemented.** Separate files under `.cursor/rules/`: `architecture.mdc`, `security.mdc`, `testing.mdc`, `research-grounding.mdc`, `email-generation.mdc`, `code-quality.mdc`.

## 14. Build health

**Implemented.** 2026-09-14:

- `npx tsc --noEmit` — passed
- `npx eslint .` — passed
- `npx vitest run` — 102 passed, 1 skipped
- `npm run build` — passed (`next build` after `prisma generate`)

`app/layout.tsx` now types `children` as `React.ReactNode` so typecheck does not depend on generated `LayoutProps`.

## 15. Confirmed-gap extras

| Gap | Status |
| --- | --- |
| Purge `data/resume.pdf` from git history | Implemented (gitignore, untrack, history rewrite, CI check). Public GitHub may still have cached copies. |
| Playwright fallback | Removed (`PLAYWRIGHT_ENABLED` deleted). Not a fake flag. |
| robots.txt + SSRF | Implemented with tests. |
| Quality-gate length 170–270 | Implemented; 320-word draft fails. |
| Tighter resume claims | Implemented; ChartWise+Wireshark regression test. |
| Resume hash bound to approval | Implemented (`EmailDraft.resumeSha256`). |
| Concurrent daily-cap test | Implemented; skipped locally without Postgres; CI service defined. |
| README hosted-auth note | Implemented. |

## Still needs the operator

1. Official resume file on disk / Railway volume (never git).
2. Google Cloud OAuth client already in use; reconnect when the testing refresh token expires (~7 days).
3. Optional `LLM_API_KEY` / `SEARCH_API_KEY` (seeded crawl and deterministic analysis work without them).
4. Do **not** put the real resume back on GitHub.
