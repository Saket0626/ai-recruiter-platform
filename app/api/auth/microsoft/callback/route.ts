import { NextResponse } from "next/server";
import { redeemAuthCode } from "@/lib/microsoft/msal";
import { getSession } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { publicError } from "@/lib/security/errors";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const description = url.searchParams.get("error_description");
  if (error) {
    logger.warn("oauth_failure", { error, description: description?.slice(0, 180) });
    const message = /AADSTS65001|consent/i.test(description ?? "")
      ? "Your Microsoft tenant blocked user consent. An admin must grant Mail.Send and User.Read."
      : description || error;
    return NextResponse.redirect(new URL(`/settings?oauthError=${encodeURIComponent(message)}`, url.origin));
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const session = await getSession();
  if (!code || !state || state !== session.oauthState) {
    return NextResponse.redirect(new URL("/settings?oauthError=Invalid+OAuth+state.+Try+connecting+again.", url.origin));
  }
  try {
    const account = await redeemAuthCode(code);
    session.connected = true;
    session.oauthState = undefined;
    session.oauthNonce = undefined;
    await session.save();
    logger.info("oauth_connected", { username: account.username });
    return NextResponse.redirect(new URL("/settings?connected=1", url.origin));
  } catch (err) {
    return NextResponse.redirect(
      new URL(`/settings?oauthError=${encodeURIComponent(publicError(err))}`, url.origin),
    );
  }
}
