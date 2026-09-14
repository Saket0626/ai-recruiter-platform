import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GmailEmailProvider, gmailErrorMessage } from "@/lib/email/gmail-provider";
import { createEmailProvider } from "@/lib/email/create-provider";
import {
  buildRfc822ResearchEmail,
  decodeGmailRaw,
  encodeGmailRaw,
  extractPdfAttachment,
} from "@/lib/email/mime";
import { assertGmailSendGrant, assertGoogleIdentity, GoogleIdentityError } from "@/lib/google/identity";
import { googleCallbackErrorMessage, googleRefreshErrorMessage } from "@/lib/google/errors";
import { mergeGoogleTokens } from "@/lib/google/tokens";
import { GMAIL_MESSAGES_SEND_URL, GMAIL_SEND_SCOPE, combineScopes, hasGmailSendScope } from "@/lib/google/scopes";
import { getEnv, resetEnvCache } from "@/lib/config/env";

vi.mock("@/lib/google/oauth", () => ({
  acquireGmailAccessToken: vi.fn(),
}));

vi.mock("@/lib/db/settings", () => ({
  getAppSettings: vi.fn(async () => ({
    AUTO_SEND: false,
    DRY_RUN: true,
    MAX_EMAILS_PER_DAY: 15,
    PROFESSOR_COOLDOWN_DAYS: 90,
    MIN_RELEVANCE_SCORE: 65,
    AUTOPILOT_MIN_SCORE: 80,
  })),
}));

vi.mock("@/lib/resume/service", () => ({
  resumeExists: () => true,
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(async () => Buffer.from("%PDF-fixture-bytes")),
  };
});

const { getAppSettings } = await import("@/lib/db/settings");

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://researchreach:test@127.0.0.1:5432/postgres");
  vi.stubEnv("DRY_RUN", "true");
  vi.stubEnv("AUTO_SEND", "false");
  vi.stubEnv("GUESS_EMAILS", "false");
  vi.stubEnv("EMAIL_PROVIDER", "gmail");
  vi.stubEnv("GOOGLE_ALLOWED_EMAIL", "saket.amanana@gmail.com");
  resetEnvCache();
  vi.mocked(getAppSettings).mockResolvedValue({
    AUTO_SEND: false,
    DRY_RUN: true,
    MAX_EMAILS_PER_DAY: 15,
    PROFESSOR_COOLDOWN_DAYS: 90,
    MIN_RELEVANCE_SCORE: 65,
    AUTOPILOT_MIN_SCORE: 80,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe("Gmail MIME construction", () => {
  it("builds multipart/mixed with the original PDF bytes", () => {
    const pdf = Buffer.from("%PDF-real-attachment");
    const mime = buildRfc822ResearchEmail({
      from: "saket.amanana@gmail.com",
      to: "prof@cs.utdallas.edu",
      subject: "Undergraduate Research Interest in Software Security",
      body: "Hello Professor Hamlen",
      filename: "resume.pdf",
      attachment: pdf,
      boundary: "rr_testboundary",
    });
    expect(mime.raw).toContain("Content-Type: multipart/mixed");
    expect(mime.raw).toContain("From: saket.amanana@gmail.com");
    expect(extractPdfAttachment(mime.raw).equals(pdf)).toBe(true);
    const decoded = decodeGmailRaw(encodeGmailRaw(mime.raw));
    expect(extractPdfAttachment(decoded).equals(pdf)).toBe(true);
  });

  it("encodes a non-ASCII subject with RFC 2047", () => {
    const mime = buildRfc822ResearchEmail({
      from: "saket.amanana@gmail.com",
      to: "prof@mit.edu",
      subject: "Research interest café",
      body: "Hello",
      filename: "resume.pdf",
      attachment: Buffer.from("%PDF-x"),
    });
    expect(mime.raw).toMatch(/Subject: =\?UTF-8\?B\?/);
  });

  it("rejects header injection", () => {
    expect(() =>
      buildRfc822ResearchEmail({
        from: "saket.amanana@gmail.com",
        to: "prof@mit.edu\r\nBcc: attacker@example.com",
        subject: "Hello",
        body: "Hello",
        filename: "resume.pdf",
        attachment: Buffer.from("%PDF-x"),
      }),
    ).toThrow(/newline/);
  });
});

describe("Google identity and scopes", () => {
  const baseClaims = {
    email: "saket.amanana@gmail.com",
    emailVerified: true,
    subject: "google-sub",
    audience: "client-id",
    issuer: "https://accounts.google.com",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    nonce: "nonce-1",
  };

  it("accepts the verified allowed Gmail identity", () => {
    expect(() =>
      assertGoogleIdentity({
        claims: baseClaims,
        expectedAudience: "client-id",
        expectedNonce: "nonce-1",
        allowedEmail: "saket.amanana@gmail.com",
      }),
    ).not.toThrow();
  });

  it("rejects the wrong Google account", () => {
    expect(() =>
      assertGoogleIdentity({
        claims: { ...baseClaims, email: "other@gmail.com" },
        expectedAudience: "client-id",
        expectedNonce: "nonce-1",
        allowedEmail: "saket.amanana@gmail.com",
      }),
    ).toThrow(GoogleIdentityError);
  });

  it("rejects a missing or replayed nonce", () => {
    expect(() =>
      assertGoogleIdentity({
        claims: { ...baseClaims, nonce: "other" },
        expectedAudience: "client-id",
        expectedNonce: "nonce-1",
        allowedEmail: "saket.amanana@gmail.com",
      }),
    ).toThrow(/nonce/i);
  });

  it("rejects missing gmail.send and extra mailbox scopes", () => {
    expect(() => assertGmailSendGrant("openid email")).toThrow(/gmail.send/i);
    expect(() =>
      assertGmailSendGrant(`${GMAIL_SEND_SCOPE} https://www.googleapis.com/auth/gmail.readonly`),
    ).toThrow(/mailbox scopes/i);
  });

  it("merges token-endpoint and tokeninfo scopes", () => {
    expect(combineScopes(undefined, ["openid", GMAIL_SEND_SCOPE])).toBe(`openid ${GMAIL_SEND_SCOPE}`);
    expect(hasGmailSendScope(combineScopes("openid email", [GMAIL_SEND_SCOPE]))).toBe(true);
  });
});

describe("Google OAuth error handling", () => {
  it("does not treat denied consent as connected", () => {
    expect(googleCallbackErrorMessage("access_denied")).toMatch(/was not changed/i);
  });

  it("explains expired or revoked refresh tokens", () => {
    expect(googleRefreshErrorMessage(new Error("invalid_grant: Token has been expired or revoked"))).toMatch(
      /7 days/i,
    );
  });

  it("preserves an existing refresh token when Google omits a replacement", () => {
    const merged = mergeGoogleTokens(
      { accessToken: "old", refreshToken: "keep-me", scope: GMAIL_SEND_SCOPE },
      { accessToken: "new", scope: GMAIL_SEND_SCOPE },
    );
    expect(merged.refreshToken).toBe("keep-me");
    expect(merged.accessToken).toBe("new");
  });
});

describe("GmailEmailProvider", () => {
  it("does not call Gmail send during dry run", async () => {
    const fetchImpl = vi.fn();
    const acquireToken = vi.fn();
    const provider = new GmailEmailProvider({ fetchImpl, acquireToken });
    const result = await provider.sendResearchEmail({
      recipient: "prof@cs.utdallas.edu",
      subject: "Undergraduate research interest",
      body: "Hello",
      resumePath: "data/fixtures/starter-resume.pdf",
    });
    expect(result).toEqual({ ok: true, dryRun: true, graphStatus: "DRY_RUN" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(acquireToken).not.toHaveBeenCalled();
  });

  it("posts base64url MIME to users.messages.send when dry run is off", async () => {
    vi.mocked(getAppSettings).mockResolvedValue({
      AUTO_SEND: false,
      DRY_RUN: false,
      MAX_EMAILS_PER_DAY: 15,
      PROFESSOR_COOLDOWN_DAYS: 90,
      MIN_RELEVANCE_SCORE: 65,
      AUTOPILOT_MIN_SCORE: 80,
    });
    const fetchImpl = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify({ id: "msg-1" }), { status: 200 }),
    );
    const acquireToken = vi.fn(async () => ({
      accessToken: "ya29.test",
      email: "saket.amanana@gmail.com",
      scope: GMAIL_SEND_SCOPE,
    }));
    const provider = new GmailEmailProvider({ fetchImpl, acquireToken });
    const result = await provider.sendResearchEmail({
      recipient: "prof@cs.utdallas.edu",
      subject: "Undergraduate research interest",
      body: "Hello",
      resumePath: "data/fixtures/starter-resume.pdf",
    });
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(GMAIL_MESSAGES_SEND_URL);
    const sent = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { raw: string };
    const rfc822 = decodeGmailRaw(sent.raw);
    expect(rfc822).toContain("From: saket.amanana@gmail.com");
    expect(extractPdfAttachment(rfc822).toString()).toBe("%PDF-fixture-bytes");
  });

  it("maps Gmail 401 to a reconnect message", () => {
    expect(gmailErrorMessage(401, "")).toMatch(/Reconnect Gmail/i);
  });
});

describe("email provider selection", () => {
  it("selects Gmail and does not construct Outlook as a fallback", () => {
    expect(getEnv().EMAIL_PROVIDER).toBe("gmail");
    expect(createEmailProvider().constructor.name).toBe("GmailEmailProvider");
  });
});
