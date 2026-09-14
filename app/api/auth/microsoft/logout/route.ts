import { NextResponse } from "next/server";
import { clearMicrosoftAccount } from "@/lib/microsoft/msal";
import { getSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  await clearMicrosoftAccount();
  const session = await getSession();
  session.connected = false;
  await session.save();
  return NextResponse.redirect(new URL("/settings", request.url));
}
