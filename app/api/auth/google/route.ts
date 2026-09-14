import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isGoogleConfigured } from "@/lib/config/env";
import { buildGoogleAuthUrl, createGoogleAuthRequest } from "@/lib/google/oauth";
import { publicOrigin } from "@/lib/http/public-origin";
import { publicError } from "@/lib/security/errors";

export async function GET(request: Request) {
  const origin = publicOrigin(request);
  try {
    if (!isGoogleConfigured()) {
      return NextResponse.redirect(
        new URL(
          "/settings?oauthError=" +
            encodeURIComponent("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before connecting Gmail."),
          origin,
        ),
      );
    }
    const authRequest = createGoogleAuthRequest();
    const session = await getSession();
    session.oauthState = authRequest.state;
    session.oauthNonce = authRequest.nonce;
    session.oauthCodeVerifier = authRequest.verifier;
    await session.save();
    return NextResponse.redirect(buildGoogleAuthUrl(authRequest));
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
}
