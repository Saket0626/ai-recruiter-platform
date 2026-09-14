import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { clearGoogleAccount } from "@/lib/google/oauth";
import { requireMutatingAccess } from "@/lib/security/access";

export async function POST(request: Request) {
  const denied = requireMutatingAccess(request);
  if (denied) return denied;
  await clearGoogleAccount();
  const session = await getSession();
  session.connected = false;
  await session.save();
  return NextResponse.redirect(new URL("/settings", request.url));
}
