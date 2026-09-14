import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { GoogleIdentityError } from "@/lib/google/identity";
import { googleCallbackErrorMessage } from "@/lib/google/errors";
import { redeemGoogleAuthCode } from "@/lib/google/oauth";
import { publicError } from "@/lib/security/errors";

function settingsRedirect(origin: string, params: Record<string, string>) {
  const url = new URL("/settings", origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    logger.warn("oauth_failure", { error, description: url.searchParams.get("error_description")?.slice(0, 180) });
    return settingsRedirect(url.origin, {
      oauthError: googleCallbackErrorMessage(error, url.searchParams.get("error_description")),
    });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const session = await getSession();
  const expectedState = session.oauthState;
  const expectedNonce = session.oauthNonce;
  const codeVerifier = session.oauthCodeVerifier;
  session.oauthState = undefined;
  session.oauthNonce = undefined;
  session.oauthCodeVerifier = undefined;
  await session.save();

  if (!code || !state || !expectedState || !expectedNonce || !codeVerifier || state !== expectedState) {
    return settingsRedirect(url.origin, {
      oauthError: "Invalid or replayed OAuth state. Try connecting Gmail again. The saved account was not changed.",
    });
  }

  try {
    const account = await redeemGoogleAuthCode({
      code,
      codeVerifier,
      expectedNonce,
    });
    session.connected = true;
    await session.save();
    logger.info("oauth_connected", { username: account.email, provider: "gmail" });
    return settingsRedirect(url.origin, { connected: "1" });
  } catch (err) {
    const message =
      err instanceof GoogleIdentityError ? err.message : publicError(err);
    logger.warn("oauth_redeem_rejected", { error: message });
    return settingsRedirect(url.origin, { oauthError: message });
  }
}
