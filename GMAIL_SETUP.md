# Gmail migration and setup

## Current status and precedence

On 2026-09-14 Saket requested Gmail instead of school Outlook, using saket.amanana@gmail.com. This supersedes earlier Microsoft-only requirements. It does not authorize actual sending or autopilot.

This document is a handoff and setup guide, not proof that Gmail is implemented or connected. No Google client credentials, token, or consent have been obtained by ChatGPT. The proposed callback below must match the implementation before login.

## Account-holder setup

1. Open https://console.cloud.google.com/ using saket.amanana@gmail.com.
2. Create/select a project for ResearchReach. Enable Gmail API in APIs & Services > Library.
3. Open Google Auth Platform. Configure app branding/name ResearchReach, support email and developer contact.
4. Choose External audience. For initial Testing, add saket.amanana@gmail.com as a test user.
5. Configure Data Access for https://www.googleapis.com/auth/gmail.send plus openid/email identity scopes. Do not enable mailbox read/modify/full access.
6. In Clients, create an OAuth client of type Web application named ResearchReach web.
7. Register the authorized redirect URI implemented by Cursor. Proposed local URI:
   http://localhost:3000/api/auth/google/callback
   For hosting, use the actual HTTPS application origin followed by /api/auth/google/callback. A localhost redirect is for a local app, not a deployed Railway service.
8. Store the client ID and secret in local ignored environment files or the deployment's secret settings. Never paste credentials into chat, GitHub, logs, screenshots, or client-side code. Do not commit downloaded client JSON.
9. After Cursor implements and verifies the flow, open Settings > Connect Gmail and approve with the intended account. Confirm the displayed verified sender and keep dry run on.
10. Review the actual draft and actual resume before separately authorizing any real send.

## Proposed application environment

EMAIL_PROVIDER=gmail
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_ALLOWED_EMAIL=saket.amanana@gmail.com
DRY_RUN=true
AUTO_SEND=false

These names are implementation requirements until Cursor wires them into configuration. Retain secure session and token encryption secrets. Microsoft variables must be optional in Gmail mode.

## Cursor implementation targets

- Add lib/google OAuth and token services using supported Google libraries; authorization-code flow, one-use state, PKCE where supported, verified ID token/identity, least privilege and encrypted owner/provider-scoped persistence.
- Add app/api/auth/google/route.ts, callback/route.ts and protected disconnect.
- Allow only the configured verified sender. login_hint is only a convenience. Wrong account, denied consent, missing Gmail send scope, or invalid callback must not save an account as connected.
- Preserve refresh tokens when a refresh result omits a replacement; invalid_grant leads to reconnect, not retry loops. Never use Microsoft cached credentials as Google tokens.
- Add GmailEmailProvider implementing the existing EmailProvider interface. Evolve graphStatus into a provider-neutral result without discarding historical Microsoft send records.
- Replace direct GraphEmailProvider selection in lib/research/pipeline.ts with explicit Gmail provider selection. No automatic Outlook fallback.
- Use users.messages.send with userId me and RFC-compliant MIME encoded as base64url raw. multipart/mixed must attach exact validated resume PDF bytes. Enforce attachment size and header injection protections and correctly encode Unicode.
- Retain local drafts so gmail.compose/mailbox read scopes are not needed.
- Update Settings UI and docs to report actual connection state and Google configuration errors.
- Retain all approval, identity, factual grounding, concurrency, limits, UNKNOWN transport outcomes, and dry-run controls described in PROJECT_SPEC.md and review comments.
- Add tests for OAuth/account/scope failures, MIME round-trip/attachment equality, revoked refresh, dry run, approval invalidation, duplicate reservations and safe error handling. Mock all transport; never send real emails in tests.
- Run tests/typecheck/lint/build and post actual results. Missing Google credentials blocks account consent, not offline implementation/tests.

## Testing-mode limitations

External Google OAuth apps in Testing using Gmail scope receive refresh tokens expiring after seven days. Implement a clear reconnect state. Broader public distribution with sensitive scopes may require verification; follow Google's process. Do not promise permanent unattended access or bypass policy/warnings.

## Official references

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/guides/configure-oauth-consent
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/workspace/gmail/api/guides/sending
- https://developers.google.com/identity/protocols/oauth2#expiration
