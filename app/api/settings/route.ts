import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSettings, setSetting } from "@/lib/db/settings";
import { publicError } from "@/lib/security/errors";
import { requireMutatingAccess } from "@/lib/security/access";

const settingsPatchSchema = z.object({
  AUTO_SEND: z.boolean().optional(),
  DRY_RUN: z.boolean().optional(),
  MAX_EMAILS_PER_DAY: z.number().int().positive().max(100).optional(),
  PROFESSOR_COOLDOWN_DAYS: z.number().int().positive().max(3650).optional(),
  MIN_RELEVANCE_SCORE: z.number().int().min(0).max(100).optional(),
  AUTOPILOT_MIN_SCORE: z.number().int().min(0).max(100).optional(),
});

export async function GET(request: Request) {
  const denied = requireMutatingAccess(request);
  if (denied) return denied;
  return NextResponse.json({ settings: await getAppSettings() });
}

export async function POST(request: Request) {
  const denied = requireMutatingAccess(request);
  if (denied) return denied;
  try {
    const parsed = settingsPatchSchema.parse(await request.json());
    if (parsed.AUTO_SEND !== undefined) await setSetting("AUTO_SEND", parsed.AUTO_SEND ? "true" : "false");
    if (parsed.DRY_RUN !== undefined) await setSetting("DRY_RUN", parsed.DRY_RUN ? "true" : "false");
    if (parsed.MAX_EMAILS_PER_DAY !== undefined) await setSetting("MAX_EMAILS_PER_DAY", String(parsed.MAX_EMAILS_PER_DAY));
    if (parsed.PROFESSOR_COOLDOWN_DAYS !== undefined) {
      await setSetting("PROFESSOR_COOLDOWN_DAYS", String(parsed.PROFESSOR_COOLDOWN_DAYS));
    }
    if (parsed.MIN_RELEVANCE_SCORE !== undefined) await setSetting("MIN_RELEVANCE_SCORE", String(parsed.MIN_RELEVANCE_SCORE));
    if (parsed.AUTOPILOT_MIN_SCORE !== undefined) await setSetting("AUTOPILOT_MIN_SCORE", String(parsed.AUTOPILOT_MIN_SCORE));
    return NextResponse.json({ settings: await getAppSettings() });
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
}
