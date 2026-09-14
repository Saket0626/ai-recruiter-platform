import { normalizeEmail } from "@/lib/security/email";
import { GOOGLE_ISSUERS, forbiddenGmailScopes, hasGmailSendScope } from "@/lib/google/scopes";

export class GoogleIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleIdentityError";
  }
}

export type GoogleIdentityClaims = {
  email?: string;
  emailVerified?: boolean;
  subject?: string;
  audience?: string | string[];
  issuer?: string;
  expiresAt?: number;
  nonce?: string;
};

export function assertGoogleIdentity(input: {
  claims: GoogleIdentityClaims;
  expectedAudience: string;
  expectedNonce: string;
  allowedEmail: string;
  now?: number;
}) {
  const { claims, expectedAudience, expectedNonce, allowedEmail } = input;
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (!claims.issuer || !GOOGLE_ISSUERS.has(claims.issuer)) {
    throw new GoogleIdentityError("Google identity issuer is invalid.");
  }
  const audiences = Array.isArray(claims.audience) ? claims.audience : [claims.audience];
  if (!audiences.includes(expectedAudience)) {
    throw new GoogleIdentityError("Google identity audience does not match this app.");
  }
  if (!claims.expiresAt || claims.expiresAt <= now) {
    throw new GoogleIdentityError("Google identity token is expired.");
  }
  if (!claims.nonce || claims.nonce !== expectedNonce) {
    throw new GoogleIdentityError("Google identity nonce did not match. Try connecting again.");
  }
  if (!claims.subject) {
    throw new GoogleIdentityError("Google identity is missing a subject.");
  }
  if (!claims.emailVerified) {
    throw new GoogleIdentityError("Google email is not verified.");
  }
  if (!claims.email || normalizeEmail(claims.email) !== normalizeEmail(allowedEmail)) {
    throw new GoogleIdentityError(
      `Connected Google account must be ${normalizeEmail(allowedEmail)}. login_hint is not identity verification.`,
    );
  }
}

export function assertGmailSendGrant(scope: string) {
  if (!hasGmailSendScope(scope)) {
    throw new GoogleIdentityError(
      "Google did not grant gmail.send. Keep Send email on your behalf checked, add that scope under Google Auth Platform Data Access, then connect again.",
    );
  }
  const forbidden = forbiddenGmailScopes(scope);
  if (forbidden.length) {
    throw new GoogleIdentityError("Google granted mailbox scopes this app does not request. Reconnect with send-only access.");
  }
}
