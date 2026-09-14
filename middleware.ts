import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/unlock",
  "/api/auth/unlock",
  "/api/auth/microsoft/callback",
  "/api/auth/google/callback",
  "/_next",
  "/favicon.ico",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const secret = process.env.APP_ACCESS_SECRET ?? "";
  if (!secret) {
    if (process.env.NODE_ENV === "production" && !isPublic(request.nextUrl.pathname)) {
      const unlock = new URL("/unlock", request.url);
      unlock.searchParams.set("reason", "missing-secret");
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "APP_ACCESS_SECRET is required in production." },
          { status: 403 },
        );
      }
      return NextResponse.redirect(unlock);
    }
    return NextResponse.next();
  }

  if (isPublic(request.nextUrl.pathname)) return NextResponse.next();

  const cookie = request.cookies.get("rr_gate")?.value;
  const header = request.headers.get("x-researchreach-secret");
  if (cookie === `rr1.${secret}` || header === secret) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unlock the app with APP_ACCESS_SECRET first." }, { status: 401 });
  }
  const unlock = new URL("/unlock", request.url);
  unlock.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
