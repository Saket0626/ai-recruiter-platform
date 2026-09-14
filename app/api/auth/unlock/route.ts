import { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessCookieValue, accessSecretsMatch } from "@/lib/security/access";
import { getEnv } from "@/lib/config/env";

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.APP_ACCESS_SECRET) {
    return NextResponse.json({ error: "APP_ACCESS_SECRET is not configured." }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { secret?: string };
  if (!body.secret || !accessSecretsMatch(body.secret, env.APP_ACCESS_SECRET)) {
    return NextResponse.json({ error: "Incorrect access secret." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: accessCookieValue(env.APP_ACCESS_SECRET),
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
