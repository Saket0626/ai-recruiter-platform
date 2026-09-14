import "server-only";
import { OAuth2Client, CodeChallengeMethod, type Credentials } from "google-auth-library";
import { getEnv, isGoogleConfigured } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import { GoogleIdentityError, assertGmailSendGrant, assertGoogleIdentity } from "@/lib/google/identity";
import { generateOauthState, generatePkcePair } from "@/lib/google/pkce";
import { GOOGLE_AUTH_SCOPES, combineScopes, hasGmailSendScope } from "@/lib/google/scopes";
import { decryptGoogleTokens, encryptGoogleTokens, mergeGoogleTokens, type GoogleTokenSet } from "@/lib/google/tokens";
import { googleRefreshErrorMessage } from "@/lib/google/errors";

export const GOOGLE_ACCOUNT_ID = "owner";

export function getGoogleOAuthClient() {
  const env = getEnv();
  if (!isGoogleConfigured()) {
    throw new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

export function createGoogleAuthRequest() {
  const pkce = generatePkcePair();
  return {
    state: generateOauthState(),
    nonce: generateOauthState(),
    verifier: pkce.verifier,
    challenge: pkce.challenge,
  };
}

export function buildGoogleAuthUrl(input: { state: string; nonce: string; challenge: string }) {
  const env = getEnv();
  const client = getGoogleOAuthClient();
  const url = new URL(
    client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent select_account",
      include_granted_scopes: false,
      scope: [...GOOGLE_AUTH_SCOPES],
      state: input.state,
      login_hint: env.GOOGLE_ALLOWED_EMAIL,
      code_challenge: input.challenge,
      code_challenge_method: CodeChallengeMethod.S256,
    }),
  );
  url.searchParams.set("nonce", input.nonce);
  return url.toString();
}

function credentialsToTokenSet(credentials: Credentials, scope?: string): GoogleTokenSet {
  if (!credentials.access_token) throw new Error("Google did not return an access token.");
  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token || undefined,
    expiryDate: credentials.expiry_date || undefined,
    scope: scope || credentials.scope || undefined,
    tokenType: credentials.token_type || undefined,
    idToken: credentials.id_token || undefined,
  };
}

async function grantedGoogleScopes(client: OAuth2Client, tokens: Credentials) {
  let scope = combineScopes(tokens.scope);
  if (hasGmailSendScope(scope) || !tokens.access_token) return scope;
  try {
    const info = await client.getTokenInfo(tokens.access_token);
    scope = combineScopes(scope, info.scopes);
  } catch {
    // Tokeninfo is only a fallback. Keep scopes from the token endpoint.
  }
  return scope;
}

export async function redeemGoogleAuthCode(input: { code: string; codeVerifier: string; expectedNonce: string }) {
  const env = getEnv();
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken({
    code: input.code,
    codeVerifier: input.codeVerifier,
  });
  if (!tokens.id_token) {
    throw new GoogleIdentityError("Google did not return an ID token. The saved Gmail account was not changed.");
  }
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  assertGoogleIdentity({
    claims: {
      email: payload?.email,
      emailVerified: payload?.email_verified,
      subject: payload?.sub,
      audience: payload?.aud,
      issuer: payload?.iss,
      expiresAt: payload?.exp,
      nonce: payload?.nonce,
    },
    expectedAudience: env.GOOGLE_CLIENT_ID,
    expectedNonce: input.expectedNonce,
    allowedEmail: env.GOOGLE_ALLOWED_EMAIL,
  });
  const scope = await grantedGoogleScopes(client, tokens);
  const tokenSet = credentialsToTokenSet(tokens, scope);
  assertGmailSendGrant(tokenSet.scope ?? "");
  const existing = await prisma.googleAuthAccount.findUnique({ where: { id: GOOGLE_ACCOUNT_ID } });
  const previousTokens = existing?.tokenPayload ? decryptGoogleTokens(existing.tokenPayload) : null;
  const merged = mergeGoogleTokens(previousTokens, tokenSet);
  if (!merged.refreshToken) {
    throw new GoogleIdentityError("Google did not return a refresh token. Reconnect Gmail and grant offline access.");
  }
  await prisma.googleAuthAccount.upsert({
    where: { id: GOOGLE_ACCOUNT_ID },
    create: {
      id: GOOGLE_ACCOUNT_ID,
      ownerKey: GOOGLE_ACCOUNT_ID,
      googleSub: payload!.sub!,
      email: payload!.email!,
      emailVerified: true,
      name: payload?.name,
      scope: merged.scope ?? "",
      tokenPayload: encryptGoogleTokens(merged),
      refreshPresent: true,
    },
    update: {
      googleSub: payload!.sub!,
      email: payload!.email!,
      emailVerified: true,
      name: payload?.name,
      scope: merged.scope ?? existing?.scope ?? "",
      tokenPayload: encryptGoogleTokens(merged),
      refreshPresent: true,
    },
  });
  return { email: payload!.email!, scope: merged.scope ?? "", hasSendScope: true };
}

export async function getGoogleAccount() {
  try {
    return await prisma.googleAuthAccount.findUnique({ where: { id: GOOGLE_ACCOUNT_ID } });
  } catch {
    return null;
  }
}

export async function acquireGmailAccessToken() {
  const row = await getGoogleAccount();
  if (!row) throw new Error("Gmail is not connected.");
  const tokens = decryptGoogleTokens(row.tokenPayload);
  if (!tokens.refreshToken) {
    throw new Error("Gmail refresh token is missing. Reconnect Gmail.");
  }
  assertGmailSendGrant(tokens.scope || row.scope);
  if (tokens.expiryDate && tokens.expiryDate > Date.now() + 60_000) {
    return { accessToken: tokens.accessToken, email: row.email, scope: tokens.scope || row.scope };
  }
  try {
    const client = getGoogleOAuthClient();
    client.setCredentials({ refresh_token: tokens.refreshToken });
    const refreshed = await client.refreshAccessToken();
    const merged = mergeGoogleTokens(
      tokens,
      credentialsToTokenSet(refreshed.credentials, await grantedGoogleScopes(client, refreshed.credentials)),
    );
    assertGmailSendGrant(merged.scope || row.scope);
    await prisma.googleAuthAccount.update({
      where: { id: GOOGLE_ACCOUNT_ID },
      data: {
        tokenPayload: encryptGoogleTokens(merged),
        scope: merged.scope || row.scope,
        refreshPresent: Boolean(merged.refreshToken),
      },
    });
    return { accessToken: merged.accessToken, email: row.email, scope: merged.scope || row.scope };
  } catch (error) {
    throw new Error(googleRefreshErrorMessage(error));
  }
}

export async function clearGoogleAccount() {
  await prisma.googleAuthAccount.deleteMany({ where: { id: GOOGLE_ACCOUNT_ID } });
}

export async function getGoogleConnectionView() {
  const env = getEnv();
  const missing: string[] = [];
  if (!env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
  const account = await getGoogleAccount();
  const hasSendScope = account ? hasGmailSendScope(account.scope) : false;
  let reconnectReason: string | null = null;
  if (account && !hasSendScope) reconnectReason = "Connected account is missing gmail.send. Reconnect Gmail.";
  if (account && !account.refreshPresent) reconnectReason = "Refresh token is missing. Reconnect Gmail.";
  return {
    configured: missing.length === 0,
    missing,
    connected: Boolean(account),
    email: account?.email ?? null,
    hasSendScope,
    allowedEmail: env.GOOGLE_ALLOWED_EMAIL,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    reconnectReason,
    testingRefreshNote:
      "Google OAuth apps in External/Testing status that use Gmail scopes generally expire refresh tokens after 7 days until the app is verified/published.",
  };
}
