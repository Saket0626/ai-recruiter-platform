# Requirements compliance

Line-by-line audit of (1) the original ResearchReach build prompt, (2) `PROJECT_SPEC.md`, and (3) the later Compliance Audit & Gap-Closure prompt, against the current codebase. Sending is **Gmail + Postgres**. Outlook/Graph and SQLite wording is superseded and was not reimplemented.

Status: **Implemented** / **Partial** / **Missing** / **Superseded**.

## Original build prompt

### Purpose and core principles

| Requirement | Status | Evidence |
| --- | --- | --- |
| Real working app, no fake demo, no mocked professors outside tests | Implemented | Discovery crawls public pages; fixtures live under `tests/` |
| Never fabricate professor information; store supporting URL; skip if insufficient | Implemented | `ResearchEvidence.url`, `INSUFFICIENT_EVIDENCE`, `validateEmailDraft` |
| Never fabricate student experience; no helped→built; no unsupported techs | Implemented | `lib/resume/claims.ts`, `tests/resume-scoring.test.ts` |
| Personalization must change opening, research, and relevance explanation | Implemented | `generateGroundedEmail` + research-detail gate |
| Prefer faculty/lab/publications evidence and save URLs | Implemented | `lib/research/pipeline.ts`, `sourcePriority` |
| Never hardcode secrets; never log tokens; `.env` gitignored | Implemented | `lib/config/env.ts`, `lib/logging/logger.ts`, `.gitignore` |
| Review Mode default; `AUTO_SEND=false`; Autopilot gated | Implemented | `lib/config/env.ts`, Settings, `assertDraftSendable` |
| 90-day cooldown; 15/day cap; no generic inboxes unless manually approved | Implemented | `lib/email/rate-limit.ts`, `allowGenericInbox` (Review Mode only; Autopilot never) |

### Tech stack and structure

| Requirement | Status | Evidence |
| --- | --- | --- |
| Next.js, React, TypeScript, Node, Prisma, Zod, Vitest | Implemented | `package.json` |
| SQLite | Superseded | Postgres / Supabase |
| Microsoft Graph / MSAL | Superseded | Gmail OAuth + `gmail.send` |
| Cheerio HTML parsing; Playwright optional JS fallback | Implemented / removed | Cheerio crawl; Playwright flag removed (gap-closure option B) |
| SearchProvider, LLMProvider, ProfessorResearchProvider, EmailProvider | Implemented | `lib/*/provider.ts` |
| Separate modules under `lib/`; Cursor rules split | Implemented | `.cursor/rules/` |

### Student profile and resume

| Requirement | Status | Evidence |
| --- | --- | --- |
| Default Saket / UT Dallas / CISTech / first-year / May 2029 | Implemented | `lib/config/defaults.ts`, parser, Settings corrections |
| Parse actual PDF at `RESUME_PATH` default `data/resume.pdf` | Implemented | `lib/resume/paths.ts`, `lib/resume/service.ts` |
| Structured StudentProfile with experiences/projects/skills | Implemented | `lib/validation/schemas.ts` |
| Stable fact IDs and excerpts | Implemented | `lib/resume/facts.ts` (`exp:`, `proj:`), shown on dashboard |
| User can review and correct extracted identity | Implemented | Settings `StudentProfileForm` |
| Missing resume disables sending with a clear error | Implemented | dashboard, send path, quality gate |
| Resume always kept at the configured path | Implemented | Local `data/resume.pdf`; Railway volume `/app/resume-data/resume.pdf` copied to `/app/data/resume.pdf` at boot. **Not in git.** |

### Discovery, crawl, scoring, LLM

| Requirement | Status | Evidence |
| --- | --- | --- |
| Configurable department/keywords/max/min score; always searches Top 100 universities | Implemented | Discover UI + `discoveryInputSchema` default `preset: "top100"` |
| Seeded crawl without search key; SearchProvider API optional | Implemented | `lib/search/seeded-crawler.ts`, `composite.ts` |
| No Google SERP HTML scraping | Implemented | Search API or seeds only |
| Crawl delay, identifiable User-Agent, cache, robots, SSRF | Implemented | `lib/search/{robots,ssrf,fetch-public}.ts` |
| Do not bypass login/CAPTCHA/paywalls | Implemented | public HTTP(S) only |
| Professor + Evidence models and statuses | Implemented | `prisma/schema.prisma` |
| Score 40/30/20/10; threshold 65; department-only does not qualify | Implemented | `lib/research/scorer.ts` |
| Zod analysis JSON; malformed repair; `insufficient_evidence` | Implemented | `lib/research/analyzer.ts`, `lib/llm/json.ts` |
| Analysis prompt: only supplied pages, no prior knowledge | Implemented | `prompts/professor-analysis.md` |

### Email writing and quality gate

| Requirement | Status | Evidence |
| --- | --- | --- |
| ~180–260 words (170–270 tolerance) | Implemented | `lib/validation/email-quality.ts` |
| Template tone; no em dashes, URLs, scores, hype, placeholders | Implemented | `lib/email/style.ts`, quality gate |
| Paragraph 2 varies by field (not always ClinicalHours) | Implemented | `pickWork` |
| Configurable, user-confirmed availability | Implemented | Settings `AVAILABILITY_SENTENCE` |
| Quality gate: email, evidence, score, duplicates, resume, claims, name, topics, personalization, resume sentence, length, other professors, papers | Implemented | `validateEmailDraft` |
| Generic inbox blocked unless manually approved; Autopilot never infers that | Implemented | professor-page override; `autopilot: true` still fails |

### Sending, review, dashboard, tests

| Requirement | Status | Evidence |
| --- | --- | --- |
| Outlook Graph sendMail | Superseded | `GmailEmailProvider` MIME PDF via `users.messages.send` |
| Validate, reserve slot, attach real PDF, persist outcome | Implemented | `sendApprovedDraft` |
| Unique/logical duplicate-send constraint | Implemented | `EmailSend_draftId_inflight_key` + cooldown |
| America/Chicago day boundary displayed | Implemented | dashboard “Sent today” |
| Review Mode UI: edit/approve/reject/regenerate/send + evidence | Implemented | `/queue`, `DraftEditor` |
| Autopilot threshold 80; failed eligibility → review | Implemented | pipeline + quality gate |
| DRY_RUN never counts as a real contact | Implemented | `professorStatusAfterSend` |
| Pages: Dashboard, Discover, Professors, Queue, Sent, Settings | Implemented | `app/` |
| Structured logs; never log tokens/resume | Implemented | `lib/logging/logger.ts` |
| Vitest coverage listed in the prompt | Implemented | 14 files; Graph/Gmail mocked; no live send |
| Hostile page cannot force a send | Implemented | `tests/email-generation.test.ts` |
| ClinicalHours 88K/70% claims not reintroduced | Implemented | `tests/resume-scoring.test.ts` |
| `.env.example` without real secrets | Implemented | `.env.example` |
| README install/Gmail/Railway/resume/tests | Implemented | `README.md` (Gmail, not Entra) |

## Gap-closure prompt (confirmed gaps)

| Item | Status |
| --- | --- |
| Access gate documented; pages query Prisma | Implemented |
| Playwright: implement or remove | Implemented (removed advertised flag) |
| robots.txt + SSRF with tests | Implemented |
| Length 170–270 | Implemented |
| Tighter named-project claims | Implemented |
| Resume SHA-256 bound to approval | Implemented |
| Concurrent daily-cap/duplicate test | Present; skipped without `RUN_DB_INTEGRATION=1` |
| Purge `data/resume.pdf` from git history | Implemented (current refs). Public caches may still exist. |
| Hosted auth is a shared secret | Documented in README |
| `REQUIREMENTS_COMPLIANCE.md` | This file |

## Build health (2026-09-15)

Commands and results from this pass:

- `npx tsc --noEmit` — passed
- `npx eslint .` — passed
- `npx vitest run` — 110 passed, 1 skipped
- `npm run build` — passed

## Remaining operator / known partials

1. Student facts are parsed resume items with stable IDs, not a separate fact-graph table.
2. Playwright JS crawl is not present (explicitly removed).
3. GitHub Actions workflow was not pushed (token lacks `workflow` scope). `npm test` still guards against committing the resume.
4. Reconnect Gmail when the ~7-day testing refresh token expires.
5. Concurrent Postgres test is skipped unless `RUN_DB_INTEGRATION=1`.

## Resume locations (do not commit)

- Local: `data/resume.pdf` (`RESUME_PATH`)
- Railway volume: `/app/resume-data/resume.pdf`
- Railway app path after start: `/app/data/resume.pdf`
