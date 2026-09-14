# ResearchReach implementation specification

## Purpose and scope

Build a local-first application for Saket to discover relevant professors, retrieve research evidence, compare it to his confirmed background, draft personalized undergraduate research-interest emails, attach his real resume, and send approved messages through Gmail (`saket.amanana@gmail.com`).

This document consolidates the user's earlier build brief and subsequent resume corrections. Sending uses Gmail (`saket.amanana@gmail.com`) rather than Outlook; `GMAIL_SETUP.md` is the current account-setup checklist. The Outlook-specific section below is historical. It specifies intended behavior, not features already implemented. No fake professor records outside tests. No placeholder resume or simulated feature presented as real.

## Architecture

Use TypeScript, Next.js, React, Node.js, SQLite, Prisma, Zod, MSAL, Microsoft Graph, and Vitest. Select compatible current stable releases using official documentation at implementation time and pin through a lockfile. Prefer Cheerio for HTML. Use Playwright only as an optional fallback for public pages requiring JavaScript, never to bypass access controls.

Separate SearchProvider, LLMProvider, ProfessorResearchProvider, and EmailProvider interfaces. Keep model keys and provider calls server-side.

Suggested directories: app/{dashboard,discover,professors,queue,sent,settings,api}, components, lib/{auth,db,email,llm,microsoft,research,search,security,validation}, prisma, prompts, data, tests, scripts, and .cursor/rules.

A real implementation must cover discovery, parsing, evidence, scoring, draft validation, review, authentication, sending, and persistent history. Do not replace required functions with TODOs.

## Student profile and resume

Proposed editable defaults: Saket Amanana, UT Dallas, first-year student pursuing Computer Information Systems and Technology, cybersecurity minor plan, expected graduation May 2029. Confirm degree/minor status against the actual current resume or user profile before using in emails. Do not silently claim an intended minor is completed or formally declared.

Parse the actual PDF locally at RESUME_PATH, default data/resume.pdf. Extract a structured StudentProfile with name, university, degree, minor/status, graduation, experiences, projects, skills, and accomplishments. Maintain supporting resume excerpts and stable fact IDs. Allow the user to review and correct the extracted profile.

The PDF is not included in this initial repository. Missing, unreadable, non-PDF, or oversized attachments must disable sending with an actionable error. Do not send without the real attachment. Track resume hash/version and invalidate stale draft approvals after replacement.

Latest user-supplied ClinicalHours wording:
- Built React/TypeScript interfaces for students to search clinical opportunities, view facility details, and submit applications across desktop and mobile.
- Developed reusable dashboard components for application tracking, onboarding tasks, and credential submission, reducing duplicated frontend logic.
- Implemented form validation, loading/error states, filtering, and API integrations across job-posting and application workflows.
- Extended backend APIs and PostgreSQL queries supporting clinical postings, applications, and onboarding data.

These corrections supersede old conversation claims about Saket personally building the 88K-record pipeline or achieving the 70% reduction. Do not reintroduce those personal accomplishment claims without explicit confirmation. Do not claim he built the whole platform alone. Canvas Companion, ChartWise, Cloud of Goods, and technical skills must be extracted from the actual resume or confirmed user facts, not assumed from examples in this document.

## Discovery and crawling

Inputs: university, university domain, department, seed faculty/directory URLs, research keywords, maximum candidates, minimum relevance score. Default university is University of Texas at Dallas; default example run targets Computer Science with up to 30 candidates.

Interest families: AI, ML, LLMs, NLP, computer vision, agents, deep learning, software engineering, program analysis, verification, programming languages, systems, cybersecurity, information security, privacy, distributed systems, cloud, networks, databases, data science, HCI, and information systems.

Support two functional discovery modes:
1. Seeded public university-directory crawling without an external search API key.
2. Configurable search API behind SearchProvider. Do not scrape Google result HTML.

Use semantic related terms rather than exact-keyword qualification alone. Prefer official university profiles, official labs, academic personal pages, official projects/publications, then reputable academic metadata. Store retrieved text, title, URL, retrieval time, and evidence excerpts.

Respect robots directives, access restrictions, crawl delays, and provider limits. Cache and deduplicate requests. Bound depth, response bytes, redirects, duration, and total pages. Only HTTP(S). Defend against SSRF by rejecting private, loopback, link-local, metadata, and reserved addresses after DNS resolution and on every redirect. Treat externally linked lab sites as separate validated origins. Never bypass login, CAPTCHAs, paywalls, or anti-bot controls.

Extract name, title, university, department, faculty URL, lab URL, research topics, and explicitly listed professional email. Prefer a university address and store its source. GUESS_EMAILS=false. Do not infer addresses from naming patterns. Skip insufficient evidence.

## Database and evidence

Implement Professor, ResearchEvidence, EmailDraft, EmailSend, AppSetting, and DiscoveryRun models. Add supporting entities as needed.

Professor: identity, full name, title, university, department, normalized email, source URL for email, faculty/lab/personal URLs, topics, summary, relevance factors/score/reason, status, timestamps.

Evidence: professor ID, source URL, title, retrievedAt, extracted text/excerpt, supported claim, stable ID.

Draft: professor, recipient, subject, body, grounded claim mappings, status, quality results, creation/update/approval timestamps, content hash, resume hash/version, failure reason.

Send: draft, normalized recipient, reservation/idempotency key, attempt time, provider outcome, status, failure reason, attachment hash. Persist sent and uncertain outcomes across restarts.

DiscoveryRun: configuration, progress, stages, errors, timestamps.
Settings: thresholds, daily limit, cooldown, review/autopilot state, dry-run state, account identity without raw credentials.

Suggested professor states: DISCOVERED, RESEARCHED, QUALIFIED, INSUFFICIENT_EVIDENCE, QUEUED, APPROVED, REJECTED, SENT, FAILED. Sending needs separate statuses for DRY_RUN, SUBMITTING, ACCEPTED, FAILED, and UNKNOWN. An HTTP acceptance response is not proof of delivery.

Normalize emails by trimming/lowercasing. Deduplicate by email, canonical faculty URL, and professor identity plus university. Use constraints/transactions, not only in-memory checks.

## Relevance scoring

Score 0 to 100, store factor breakdown and reason:
- Up to 40: direct AI/ML/LLM/NLP/vision/agent/data science relevance.
- Up to 30: software/systems/security/privacy/program analysis/languages/distributed systems/databases/networking/information systems.
- Up to 20: concrete connection to confirmed student skills/projects.
- Up to 10: evidence of active projects/publications/research.

Use deterministic factors plus schema-validated model analysis. Default qualification threshold 65; configurable. Department membership alone is not evidence of a match. This initial weighting favors AI plus software overlap; show factors transparently and allow later user tuning rather than silently changing weights.

Analysis JSON includes insufficient_evidence, research_topics, research_summary, current_projects, student_connections, relevance_score, relevance_reason, and evidence_claims. Every factual claim needs an existing source ID, URL, and actual supporting excerpt. Validate source membership and entailment/support; JSON validity alone is not grounding. Use bounded malformed-output repair. Reject unsupported content instead of inventing replacements.

## Email writing and quality

Use prompts/email-generation.md and the supplied base template. Generally 180 to 260 words, straightforward first-year student voice, modest claims, no em dashes, corporate buzzwords, exaggerated praise, placeholders, relevance scores, or URLs in the email.

Paragraph 1: introduce Saket and UT Dallas/CISTech status; name one or two verified research interests; ask to learn and assist.
Paragraph 2: select the most relevant confirmed experience, not always ClinicalHours.
Paragraph 3: explain a specific, honest connection and interest in learning; mention real resume attachment, confirmed availability, thanks, and signature.

Do not claim to have read a paper unless the user says so. Do not invent paper titles, lab names, experience, technologies, or research achievements. Only refer to a lab if its existence is supported. Availability wording must be configurable and user-confirmed rather than treated as perpetually current.

Subject: concise, e.g. "Undergraduate Research Interest in Software Security".

Quality gate before queueing and again before sending:
- Valid, verified faculty address and name-recipient match.
- Sufficient evidence, score threshold, valid claim mappings.
- No unsupported professor or student facts.
- No accidental duplicate, cooldown breach, or daily cap breach.
- Real valid PDF available and bound to current draft.
- Research-specific personalization and resume statement.
- No placeholders, another professor's name, fabricated papers, URLs by default, or prohibited style.
- Reasonable length and subject.
- Editable failure reasons visible in dashboard.

Manually edited or regenerated drafts must be revalidated and reapproved. Block generic inboxes such as info@, admissions@, department@, support@, contact@, office@ unless specifically approved manually. Autopilot must never infer that exception.

## Gmail authentication and sending

This section supersedes the original Outlook/Microsoft Graph sending requirement.

Implement Google OAuth 2.0 authorization code flow with a supported Google auth library. Use scopes `openid`, `email`, and `https://www.googleapis.com/auth/gmail.send`, with `access_type=offline` for refresh. Do not request `gmail.readonly`, `gmail.modify`, `gmail.compose`, or full mailbox access. Keep drafts local.

Validate one-use state, PKCE, verified ID token audience/issuer/expiry/nonce, and require verified email `GOOGLE_ALLOWED_EMAIL` (default `saket.amanana@gmail.com`). `login_hint` is not identity verification. Denied consent or the wrong account must not replace the saved account.

Encrypt Google tokens separately from any leftover Microsoft cache. Preserve an existing refresh token if a later grant omits one.

Implement `GmailEmailProvider` behind `EmailProvider`. Send RFC 2822 MIME multipart/mixed with the actual PDF, encoded base64url, via `users.messages.send` (`userId=me`). From must be the verified configured Gmail identity. `EMAIL_PROVIDER=gmail` is the default. Do not fall back to Outlook.

## Outlook authentication and sending (superseded)

The original Outlook/MSAL/Graph requirement is retained below only as historical context. Do not implement Outlook as the live sending path.

Implement browser OAuth authorization code flow with MSAL and Microsoft Graph delegated access. Validate state, redirect targets, CSRF/session protections, and use PKCE where supported for the selected architecture. Do not ask for Microsoft passwords.

Use delegated Mail.Send; request User.Read only if necessary. Use required standard identity scopes and offline access only as justified. Do not request Mail.Read absent a genuinely required, user-authorized feature.

Configure client ID, tenant ID, redirect URI, and server-side confidential client secret where required. Support common only when the registered account types permit it. Keep token cache protected/encrypted at rest, out of Git/logs/browser, with a documented key strategy. Handle expired sessions and organizational tenant consent restrictions clearly; never bypass them.

Implement POST /me/sendMail, saveToSentItems=true, text or safely escaped HTML, and actual application/pdf fileAttachment using @odata.type, name, contentType, and base64 contentBytes. Verify current Microsoft limits before implementation and fail safely with useful attachment errors.

A single send service must revalidate, reserve the recipient and daily slot transactionally, verify approval/content/resume hashes, construct the Graph message, call the authenticated account, and persist the outcome.

Never promise exactly-once delivery from a local duplicate check. If the transport outcome is ambiguous after submission, record UNKNOWN and require reconciliation; do not blindly retry and risk duplicate messages. Respect Retry-After for explicit throttling without evading limits. Treat Graph acceptance as accepted, not verified delivered.

Default maximum actual emails/day 15; configurable cooldown 90 days. Define and display the timezone/day boundary. Concurrency must not bypass either limit. Do not automatically schedule repeat contacts at cooldown expiry; new outreach requires fresh eligibility and authorization.

## Review, dry run, autopilot

Review Mode is default. AUTO_SEND=false, DRY_RUN=true.
Review queue supports edit, regenerate, approve, reject, and explicitly confirm send. Approval alone does not have to send automatically; make the action explicit.

DRY_RUN executes validation and sanitized preview persistence but never invokes Graph sendMail. It does not count as a real sent contact. Do not log resume bytes or sensitive message data indiscriminately.

Autopilot must be deliberately enabled by the user in Settings. Default threshold 80. Require all quality checks, verified faculty address, real resume, no previous send for automatic first contact, sufficient evidence, available daily capacity, no placeholders, and no generic inbox. Failed autopilot eligibility goes to review, not silent sending. Introduce a small delay between automated sends for pacing, not limit evasion. Uncertainty is never authorization.

Effective dry-run/autopilot settings must have a documented precedence. Blank/malformed safety flags must fail closed. UI labels must reflect actual server settings. Development and all automated tests must remain non-sending.

## Dashboard and operations

Pages: Dashboard, Discover, Professors, Review Queue, Sent, Settings.
Show counts of discovered/qualified/awaiting approval/approved/sent/failed and today's sending usage. Discovery progress covers discover, extract, research, evidence, analyze, score, filter, personalize, validate, queue, approve, send, log.

Professor detail displays identity, address, topics, score factors, explanation, evidence links/excerpts, draft, and validation results. Queue displays evidence beside email and the resume version attached. Sent history distinguishes dry run, provider accepted, failed, and unknown outcomes. Provide responsive layout, accessible forms, loading/empty/error states, and clear send confirmations.

Use structured sanitized logs for discovery, research, qualification, generation, validation, approval, send attempt, and outcome. Never log access/refresh tokens, secrets, API keys, or resume contents. Handle dead pages, timeouts, invalid HTML, model errors, malformed JSON, missing resume, OAuth failures, Graph 401/403/throttling, database failures, and duplicate sends. Never expose raw stack traces or secrets in UI.

## Tests and completion

Vitest tests and realistic offline fixtures must cover parsing, email extraction, URL normalization, SSRF defenses, duplicates, scoring, schemas, missing/invalid resume, profile extraction, unsupported claims, style checks, generic inbox blocking, cooldown, concurrent rate limiting, approval invalidation, Graph payload/attachment construction, auth/transport failures, throttling, ambiguous sends, and dry-run isolation.

Test AI/security/information-systems personalization; irrelevant and insufficient-evidence faculty must receive no eligible email. Prove old ClinicalHours pipeline/70% claims are not reintroduced. Include hostile page instructions and test that they cannot set recipients, approve drafts, expose secrets, or trigger sending. All Graph sends mocked. Fixtures must be clearly test-only.

After implementation run typecheck, lint, tests, and production build. Fix errors without weakening tests. Report exact commands and results, not assumed passes.

README must document verified install/run/test commands, architecture, DB setup, resume path, LLM/search configuration, Microsoft Entra registration, account types, redirect URI, least-privilege scopes, IDs/secret setup, consent restrictions, OAuth connection, first user-approved real send, review/autopilot, dry run, and troubleshooting.

Done means a user can install, configure, add a real resume, log in, discover actual faculty, inspect evidence and scores, generate and edit grounded drafts, approve and send with the actual attachment, see truthful history, avoid duplicates, and run passing checks. External credentials and user consent remain explicit setup steps.
