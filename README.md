# ResearchReach

This is Saket's personal outreach bot. It is not a multi-user product. It scours public faculty pages across UTD, UT Austin, and the rest of the Top 100 U.S. universities, finds professors in AI, software engineering, information systems, and CISTech-adjacent research, retrieves their published work, and drafts a unique Cavusoglu-style email with the resume attached.

Run it from the terminal:

```bash
npm run bot
```

Each new professor is printed in this layout and appended to the shared Google Doc:

```
professor's email: name@university.edu
research: https://...
professor name: Full Name
professor college: University
email draft:
Subject: ...

Hello Dr. LastName,
...
```

The bot reads that Google Doc first so the same professor is never written twice. It crawls a fresh batch of colleges each run, with a hard cap of 15 professors per college.

```bash
npm run bot -- --report           # print new packages, do not crawl again
npm run bot -- --colleges=6       # how many colleges to visit this hour
npm run bot -- --send             # live Gmail only if DRY_RUN=false
```

`--send` stays fail-closed. Keep `DRY_RUN=true` unless you intentionally enable live sending.

Professor claims come only from pages the bot retrieved. Student claims come only from `data/resume.pdf` and explicit profile fields. If a page has no published-research evidence, or the work is not AI/CISTech-relevant, the professor is marked `INSUFFICIENT_EVIDENCE` and no email is drafted.

The Next.js UI is optional review/history. The bot is the primary interface.

## Shared project (Cursor + ChatGPT Astra)

Repository: https://github.com/Saket0626/ai-recruiter-platform

ChatGPT Astra and Cursor both work on this GitHub repo. Chat histories are not synced. Pull before you start, commit and push to share work, and do not overwrite uncommitted changes. Persistent rules are in `AGENTS.md` and `.cursor/rules/`.

Keep `DRY_RUN=true` and `AUTO_SEND=false` until you intentionally enable live sending.

## What it does

1. Discovery searches all Top 100 U.S. universities automatically. You do not pick schools.
2. The app crawls public faculty directory URLs for that school and, if you configured a search API key, runs `site:that-university-domain` queries.
3. It stores source URLs and extracted text for every research claim.
4. It scores relevance against Saket's resume and the configured research families (AI, software engineering, security, information systems, and related areas).
5. It generates a professor-specific email in the style of the provided undergraduate template.
6. Review Mode is the default. You edit, approve, reject, or send.
7. Sending uses the Gmail API `users.messages.send` with the actual resume PDF attached as RFC 2822 MIME. `DRY_RUN=true` by default, so first-time installs never call Gmail.

## Architecture

| Area | Location |
| --- | --- |
| Personal outreach bot | `scripts/outreach-bot.ts`, `lib/bot/` |
| UI (optional review) | `app/`, `components/` |
| Discovery / crawl / score | `lib/research/`, `lib/search/` |
| Resume | `lib/resume/` |
| Email generation and Gmail send | `lib/email/`, `lib/google/` |
| University catalog | `data/universities.json`, `lib/universities/catalog.ts` |
| Prompts | `prompts/` |
| Database | `prisma/schema.prisma` (Postgres / Supabase) |

Provider interfaces:

- `SearchProvider`
- `LLMProvider`
- `ProfessorResearchProvider`
- `EmailProvider`

UI pages never call Gmail, crawl the web, or invoke an LLM directly. Route handlers and server-only services own those side effects.

## Requirements

- Node.js 20+
- npm
- A PDF resume
- Optional: OpenAI-compatible LLM key
- Optional: Tavily or Brave search API key
- Google Cloud OAuth client and Gmail API before live Gmail sending

## Installation

```bash
npm install
cp .env.example .env
cp .env.example .env.local
```

Generate a long `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` (32+ characters each) and put them in `.env` and `.env.local`.

```bash
npx prisma migrate deploy
```

Copy your real resume PDF to `data/resume.pdf`. `npm run resume:generate` writes an isolated test fixture at `data/fixtures/starter-resume.pdf` and will refuse to overwrite the real resume.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database (Supabase Postgres)

Production and shared development use Postgres on the Supabase project `ai-recruiter-platform` (`vtrjwkinmmhsuomyfrri`).

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"
```

Get the URI from Supabase **Project Settings → Database**. Use the pooler on port `6543` for `DATABASE_URL` and session/direct on `5432` for `DIRECT_URL` (Prisma migrations).

```bash
npx prisma migrate deploy
```

Tables: professors, evidence, drafts, sends, settings, discovery runs, page cache, and the encrypted Gmail token store. Row Level Security is enabled on app tables. The server uses Prisma with the database URL, not the browser anon key.

## Railway

The app deploys to Railway with the Dockerfile in this repo.

1. Railway project: `ai-recruiter-platform`
2. Set the same secrets as `.env.example` (never commit them). Required: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, `DRY_RUN=true`, `AUTO_SEND=false`, `APP_ACCESS_SECRET`
3. Set `GOOGLE_REDIRECT_URI` to `https://<the-actual-Railway-host>/api/auth/google/callback` using the URL Railway assigned. Do not guess a domain. The current live host, if unchanged, is `https://web-production-3b016.up.railway.app`.
4. `DRY_RUN` stays true until you turn it off. Production refuses anonymous access unless `APP_ACCESS_SECRET` is set and the operator unlocks the app. Connecting Gmail does not send a test email.

The resume PDF is not in git and must never be committed. It must exist at `data/resume.pdf` locally. On Railway the same file is stored on `web-volume` at `/app/resume-data/resume.pdf` and copied to `/app/data/resume.pdf` on every start so `RESUME_PATH=data/resume.pdf` stays valid. Without a resume, sending stays disabled.

## Access gate

`/unlock` is a real access-control feature, not a stand-in for Gmail login. Hosted ResearchReach can hold a live Gmail send grant, so the app is not left open on the public Railway URL.

- Set `APP_ACCESS_SECRET` in `.env.local` (local, optional) and in Railway (required in production).
- Open `/unlock`, enter that passcode, then continue. The browser stores an `rr_gate` cookie.
- Change the passcode by rotating `APP_ACCESS_SECRET` and unlocking again. Old cookies stop working.
- This is a **shared operator secret** for a single-user tool. It is not a per-user Google session on every route. Gmail OAuth still verifies `saket.amanana@gmail.com` before sending.

Local development with `APP_ACCESS_SECRET` empty skips the gate so `npm run dev` works without unlocking.

## Resume

Default path: `data/resume.pdf`

The app also looks at `/app/resume-data/resume.pdf` so a Railway volume copy is enough. Startup copies the volume file onto `data/resume.pdf` so that default path stays populated.

Override with:

```
RESUME_PATH=data/resume.pdf
```

Put your real PDF there. `npm run resume:generate` writes `data/fixtures/starter-resume.pdf` only. It will not overwrite `data/resume.pdf`. If the real file is missing, the dashboard shows an error and sending is disabled.

The parser, not this README, is the source of truth for experience wording. It will not turn "helped" into "built".

## University catalog

Research is not limited to UT Dallas. `data/universities.json` includes 100+ U.S. universities. Every Discover run searches the **Top 100 U.S. universities** catalog (2026 U.S. News-style national universities). You do not choose a subset.

Each catalog entry has:

- name, short name, aliases
- domain
- national rank when the school is in the Top 100 set
- default CS/engineering/information-systems departments
- faculty directory seed URLs when known

Seeded crawling uses each school's own faculty URLs. Search queries use `site:that-domain`, not a hardcoded UT Dallas domain. A multi-school run keeps a per-university candidate cap so one directory cannot consume the whole budget.

You can still paste extra faculty URLs when a single school is selected.

## Google Cloud and Gmail

You never type a Gmail password into ResearchReach. Sending uses Google OAuth and the Gmail API send scope only.

Intended sender: `saket.amanana@gmail.com`. `login_hint` is not identity verification; the app checks the verified ID token email.

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable the **Gmail API**.
4. Configure the OAuth consent screen:
   - User type: **External**
   - Add `saket.amanana@gmail.com` as a test user
   - Scopes: `openid`, `email`, and `https://www.googleapis.com/auth/gmail.send`
   - Do **not** add `gmail.readonly`, `gmail.modify`, `gmail.compose`, or `https://mail.google.com/`
5. Create an OAuth client:
   - Application type: **Web application**
   - Authorized redirect URI (local): `http://localhost:3000/api/auth/google/callback`
   - Authorized redirect URI (hosted): `https://<your-actual-app-host>/api/auth/google/callback`
6. Put the client ID and secret in `.env.local` and the host environment. Do not paste them into chat or GitHub.

```
EMAIL_PROVIDER=gmail
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_ALLOWED_EMAIL=saket.amanana@gmail.com
```

Then open **Settings** → **Connect Gmail**. After sign-in you return to Settings. Tokens are encrypted in Postgres. They are never printed in logs.

Connecting Gmail does not authorize a test send. Keep `DRY_RUN=true` until you intentionally send.

Google apps in External/Testing status that use Gmail scopes generally expire refresh tokens after 7 days until the app is verified/published. The Settings page tells you to reconnect when that happens. Do not bypass Google's verification warnings.

Official references:

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/workspace/gmail/api/guides/sending

## LLM provider

Leave `LLM_API_KEY` empty to use grounded deterministic analysis of retrieved page text. To use an OpenAI-compatible API:

```
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
LLM_BASE_URL=https://api.openai.com/v1
```

Calls run only on the server. Analysis uses low temperature. Retrieved pages are passed as untrusted `DATA` and cannot override instructions.

## Search

Seeded university crawling works with no search key.

Optional:

```
SEARCH_PROVIDER=tavily
SEARCH_API_KEY=
SEARCH_API_URL=
```

`SEARCH_PROVIDER=brave` uses Brave Search instead. The app does not scrape Google HTML.

## How to run discovery

Primary path is the personal bot:

```bash
npm run bot
```

It always walks all Top 100 schools (UTD, UT Austin, and the rest of the catalog), follows publication/Scholar links when they appear on a faculty page, and drafts only when the retrieved pages show published AI/CISTech-relevant research plus a real professor email.

The Discover page is optional review UI. Pipeline: discover → extract → retrieve pages (including publication links) → store evidence → analyze → score → filter → personalize → validate → queue.

## Review Mode and Autopilot

Review Mode is default. `AUTO_SEND=false`.

On **Review Queue** you can edit the subject/body, regenerate, approve, reject, or send. Evidence links sit next to the draft.

Autopilot is off until you enable it in Settings. Even then it only sends if:

- score ≥ `AUTOPILOT_MIN_SCORE` (default 80)
- every quality check passes
- faculty email is valid and not a generic inbox
- resume exists
- no cooldown hit
- daily cap not exceeded
- no placeholder text

Uncertainty goes to the manual queue.

## First test email

1. Keep `DRY_RUN=true`.
2. Connect Gmail (optional for dry run; required before a live send).
3. Run discovery.
4. Open a qualified professor, read the evidence, edit if needed, approve, send.
5. Confirm a `DRY_RUN` row on **Sent**. No Graph `sendMail` call happens.
6. When you are ready, set `DRY_RUN=false` in Settings or `.env.local` and send again. Gmail attaches `data/resume.pdf` as `application/pdf`.

Defaults: 15 emails/day, 90-day recontact cooldown.

## Tests

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Tests mock Gmail/OAuth/transport by constructing MIME payloads only. They never send real email. Fixtures cover faculty HTML, prompt-injection page text, personalization, and the university catalog.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| Resume missing | Place a PDF at `data/resume.pdf` or set `RESUME_PATH` |
| Gmail connect fails | Check client ID/secret, exact redirect URI, Gmail API enabled, test user added |
| Wrong Google account | Sign in as saket.amanana@gmail.com; the saved account is not replaced |
| Gmail 401 / invalid_grant | Reconnect Gmail. Testing apps often expire refresh tokens after 7 days |
| Gmail 429 | Wait for Retry-After; the app surfaces the throttle |
| No professors found | Add a working faculty directory URL; some campuses need extra seeds |
| Discovery is slow | That is expected; crawl delay is intentional |
| LLM errors | The app falls back to deterministic grounded analysis |

## Security notes

- Never commit `.env`, `.env.local`, or token caches.
- Never log access tokens, refresh tokens, API keys, or resume contents.
- Retrieved webpages are untrusted data. Prompt-injection text is not executed.
- Do not guess professor emails unless `GUESS_EMAILS=true`.
- Generic inboxes (`info@`, `admissions@`, `department@`, `support@`, `contact@`, `office@`, …) are blocked unless you later extend manual override in the queue by editing a known personal address on the professor record.

## Environment variables

See `.env.example` for the full list, including `DRY_RUN=true`, `AUTO_SEND=false`, `MAX_EMAILS_PER_DAY=15`, and `PROFESSOR_COOLDOWN_DAYS=90`.

## Spec files from ChatGPT Astra

`PROJECT_SPEC.md`, `IMPLEMENTATION_PLAN.md`, and `COLLABORATION.md` are the shared Cursor/ChatGPT review workflow. The application in this repo is implemented; treat those files as the requirements checklist, not as proof the app is unfinished.
