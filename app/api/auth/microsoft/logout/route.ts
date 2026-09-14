import { NextResponse } from "next/server";
import { clearMicrosoftAccount } from "@/lib/microsoft/msal";
import { getSession } from "@/lib/auth/session";
import { requireMutatingAccess } from "@/lib/security/access";

export async function POST(request: Request) {
  const denied = requireMutatingAccess(request);
  if (denied) return denied;
  await clearMicrosoftAccount();
  const session = await getSession();
  session.connected = false;
  await session.save();
  return NextResponse.redirect(new URL("/settings", request.url));
}
