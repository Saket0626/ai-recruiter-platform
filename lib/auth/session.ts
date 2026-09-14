import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/config/env";

export type SessionData = {
  oauthState?: string;
  oauthNonce?: string;
  oauthCodeVerifier?: string;
  connected?: boolean;
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, {
    cookieName: "researchreach_session",
    password: getEnv().SESSION_SECRET,
    ttl: 60 * 60 * 24 * 14,
  });
}
