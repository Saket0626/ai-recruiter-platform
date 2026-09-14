import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/config/env";

export const ACCESS_COOKIE = "rr_gate";

export function accessCookieValue(secret: string) {
  return `rr1.${secret}`;
}

export function accessSecretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function sameOriginOrMissing(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (!host) return false;
    return new URL(origin).host === host.split(",")[0]?.trim();
  } catch {
    return false;
  }
}

export function requireMutatingAccess(request: Request): NextResponse | null {
  if (request.method !== "GET" && request.method !== "HEAD" && !sameOriginOrMissing(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  }
  const env = getEnv();
  const secret = env.APP_ACCESS_SECRET;
  if (!secret) {
    if (env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "APP_ACCESS_SECRET is required in production. Set it on the host and unlock the app." },
        { status: 403 },
      );
    }
    return null;
  }
  const header = request.headers.get("x-researchreach-secret") ?? "";
  const cookie = parseCookie(request.headers.get("cookie") ?? "")[ACCESS_COOKIE] ?? "";
  if (accessSecretsMatch(header, secret) || accessSecretsMatch(cookie, accessCookieValue(secret))) {
    return null;
  }
  return NextResponse.json({ error: "Unlock the app with APP_ACCESS_SECRET first." }, { status: 401 });
}

function parseCookie(header: string) {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (!key) continue;
    out[key] = decodeURIComponent(rest.join("="));
  }
  return out;
}
