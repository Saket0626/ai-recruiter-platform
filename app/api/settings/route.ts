import { NextResponse } from "next/server";
import { getAppSettings, setSetting } from "@/lib/db/settings";
import { publicError } from "@/lib/security/errors";

export async function GET() {
  return NextResponse.json({ settings: await getAppSettings() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const allowed = [
      "AUTO_SEND",
      "DRY_RUN",
      "MAX_EMAILS_PER_DAY",
      "PROFESSOR_COOLDOWN_DAYS",
      "MIN_RELEVANCE_SCORE",
      "AUTOPILOT_MIN_SCORE",
    ];
    for (const key of allowed) {
      if (body[key] !== undefined) await setSetting(key, String(body[key]));
    }
    return NextResponse.json({ settings: await getAppSettings() });
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
}
