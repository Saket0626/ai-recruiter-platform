# ResearchReach

ResearchReach helps a college student find professors whose public research actually matches their background, draft a personalized undergraduate research-interest email, attach a real resume PDF, and send approved messages through Microsoft Outlook with Microsoft Graph.

It is a Next.js app with a Postgres database on Supabase. Professor claims come only from pages the app retrieved. Student claims come only from the resume PDF and explicit profile fields. If evidence is thin, the professor is marked `INSUFFICIENT_EVIDENCE` and no email is sent.

## Shared project (Cursor + ChatGPT Astra)

Repository: https://github.com/Saket0626/ai-recruiter-platform

ChatGPT Astra and Cursor both work on this GitHub repo. Chat histories are not synced. Pull before you start, commit and push to share work, and do not overwrite uncommitted changes. Persistent rules are in `AGENTS.md` and `.cursor/rules/`.

Keep `DRY_RUN=true` and `AUTO_SEND=false` until you intentionally enable live sending.

## What it does

1. You pick one university, several universities, or the Top 100 U.S. universities preset (UT Dallas is the default starter, not the only option).
2. The app crawls public faculty directory URLs for that school and, if you configured a search API key, runs `site:that-university-domain` queries.
3. It stores source URLs and extracted text for every research claim.
4. It scores relevance against Saket's resume and the configured research families (AI, software engineering, security, information systems, and related areas).
5. It generates a professor-specific email in the style of the provided undergraduate template.
6. Review Mode is the default. You edit, approve, reject, or send.
7. Sending uses delegated Microsoft Graph `POST /me/sendMail` with the actual resume PDF attached. `DRY_RUN=true` by default, so first-time installs never call Graph.

## Architecture

| Area | Location |
| --- | --- |
| UI | `app/`, `components/` |
| Discovery / crawl / score | `lib/research/`, `lib/search/` |
| Resume | `lib/resume/` |
| Email generation and Graph send | `lib/email/`, `lib/microsoft/` |
| University catalog | `data/universities.json`, `lib/universities/catalog.ts` |
| Prompts | `prompts/` |
| Database | `prisma/schema.prisma` (Postgres / Supabase) |

Provider interfaces:

- `SearchProvider`
- `LLMProvider`
- `ProfessorResearchProvider`
- `EmailProvider`

UI pages never call Microsoft Graph, crawl the web, or invoke an LLM. Route handlers and server-only services own those side effects.

## Requirements

- Node.js 20+
- npm
- A PDF resume
- Optional: OpenAI-compatible LLM key
- Optional: Tavily or Brave search API key
- Microsoft Entra app registration before live Outlook sending

## Installation

```bash
npm install
cp .env.example .env
cp .env.example .env.local
```

Generate a long `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` (32+ characters each) and put them in `.env` and `.env.local`.

```bash
npx prisma migrate deploy
npm run resume:generate
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

Tables: professors, evidence, drafts, sends, settings, discovery runs, page cache, and the encrypted Outlook token cache. Row Level Security is enabled on app tables. The server uses Prisma with the database URL, not the browser anon key.

## Railway

The app deploys to Railway with the Dockerfile in this repo.

1. Railway project: `ai-recruiter-platform`
2. Set the same secrets as `.env.example` (never commit them). Required: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, `DRY_RUN=true`, `AUTO_SEND=false`
3. After Railway gives a public URL, set `MICROSOFT_REDIRECT_URI` to `https://YOUR-DOMAIN/api/auth/microsoft/callback` in both Railway and Entra
4. `DRY_RUN` stays true until you turn it off

The resume PDF is not in git. Upload it to the service (or set `RESUME_PATH` to a mounted file) before live sending. Without a resume, sending stays disabled.

## Resume

Default path: `data/resume.pdf`

Override with:

```
RESUME_PATH=data/resume.pdf
```

Put your real PDF there. `npm run resume:generate` writes a starter PDF from the facts in this repo so the parser has something to read on first run. Replace it with your actual resume. If the file is missing, the dashboard shows an error and sending is disabled.

The parser, not this README, is the source of truth for experience wording. It will not turn "helped" into "built".

## University catalog

Research is not limited to UT Dallas. `data/universities.json` includes 100+ U.S. universities. The Discover page can run against:

- one school (UT Dallas is only the default starter)
- several schools you pick from search
- **Top 100 U.S. universities** (2026 U.S. News-style national universities, 100 schools)
- **Top CS programs** (MIT, Stanford, CMU, Berkeley, Georgia Tech, UIUC, Michigan, UT Austin, and others, plus UT Dallas)

Each catalog entry has:

- name, short name, aliases
- domain
- national rank when the school is in the Top 100 set
- default CS/engineering/information-systems departments
- faculty directory seed URLs when known

Seeded crawling uses each school's own faculty URLs. Search queries use `site:that-domain`, not a hardcoded UT Dallas domain. A multi-school run keeps a per-university candidate cap so one directory cannot consume the whole budget.

You can still paste extra faculty URLs when a single school is selected.

## Microsoft Entra app registration

You never type an Outlook password into ResearchReach. Outlook uses OAuth.

1. Sign in at [https://entra.microsoft.com/](https://entra.microsoft.com/) (Microsoft Entra admin center).
2. Go to **Identity** → **Applications** → **App registrations** → **New registration**.
3. Name it `ResearchReach`.
4. Under **Supported account types**, choose **Accounts in any organizational directory and personal Microsoft accounts** if you want both school and personal Outlook. That corresponds to `MICROSOFT_TENANT_ID=common`.
5. Redirect URI:
   - Platform: **Web**
   - URI: `http://localhost:3000/api/auth/microsoft/callback`
6. Register.

### Client ID and secret

- **Application (client) ID** → `MICROSOFT_CLIENT_ID`
- **Certificates & secrets** → **New client secret** → `MICROSOFT_CLIENT_SECRET`
- **Directory (tenant) ID** → `MICROSOFT_TENANT_ID` (or leave `common`)

### Graph permissions

**API permissions** → **Microsoft Graph** → **Delegated permissions**:

- `Mail.Send`
- `User.Read`
- OpenID permissions that Entra adds for sign-in (`openid`, `profile`, `offline_access`)

Do **not** add `Mail.Read`. Grant admin consent only if your tenant requires it. ResearchReach does not request mailbox read access.

If a campus tenant blocks user consent, the app shows that error instead of failing silently. An admin must grant the delegated permissions.

### Environment variables for Microsoft

```
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/auth/microsoft/callback
```

Then open **Settings** → **Connect Outlook**. After sign-in you return to Settings. Tokens are encrypted in Postgres. They are never printed in logs.

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

1. Open **Discover**.
2. Search for universities (Harvard, MIT, Michigan, Georgia Tech, …) or click **Top 100 U.S. universities**.
3. Confirm departments and, for a single school, faculty seed URLs.
4. Set research interests, total candidate cap, per-university cap, and minimum score (default 65).
5. Start discovery. Multi-school runs report which university is in progress.

Pipeline: discover → extract → retrieve pages → store evidence → analyze → score → filter → personalize → validate → queue.

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
2. Connect Outlook (optional for dry run).
3. Run discovery.
4. Open a qualified professor, read the evidence, edit if needed, approve, send.
5. Confirm a `DRY_RUN` row on **Sent**. No Graph `sendMail` call happens.
6. When you are ready, set `DRY_RUN=false` in Settings or `.env.local` and send again. Graph attaches `data/resume.pdf` as `application/pdf`.

Defaults: 15 emails/day, 90-day recontact cooldown.

## Tests

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Tests mock Graph by constructing payloads only. They never send real email. Fixtures cover faculty HTML, prompt-injection page text, personalization, and the university catalog.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| Resume missing | Place a PDF at `data/resume.pdf` or set `RESUME_PATH` |
| Outlook connect fails | Check client ID/secret, redirect URI exact match, tenant `common` vs single-tenant |
| Tenant consent error | Admin must grant `Mail.Send` and `User.Read` |
| Graph 401 | Connect Outlook again |
| Graph 429 | Wait for Retry-After; the app surfaces the throttle |
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
