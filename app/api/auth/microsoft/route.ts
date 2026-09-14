import { NextResponse } from "next/server";
import { createAuthCodeUrl, cryptoProvider } from "@/lib/microsoft/msal";
import { getSession } from "@/lib/auth/session";
import { isMicrosoftConfigured } from "@/lib/config/env";
import { publicError } from "@/lib/security/errors";

export async function GET() {
  try {
    if (!isMicrosoftConfigured()) {
      return NextResponse.json(
        { error: "Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET before connecting Outlook." },
        { status: 400 },
      );
    }
    const { verifier: nonce } = await cryptoProvider.generatePkceCodes();
    const state = cryptoProvider.createNewGuid();
    const session = await getSession();
    session.oauthState = state;
    session.oauthNonce = nonce;
    await session.save();
    const url = await createAuthCodeUrl(state, nonce);
    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
}
