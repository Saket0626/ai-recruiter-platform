import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sentCountToday } from "@/lib/email/rate-limit";
import { loadStudentProfile, resumeExists } from "@/lib/resume/service";
import { getAppSettings } from "@/lib/db/settings";
import { getGoogleConnectionView } from "@/lib/google/oauth";

export async function GET() {
  const [discovered, qualified, queued, approved, sent, failed, daily, google] = await Promise.all([
    prisma.professor.count(),
    prisma.professor.count({ where: { status: { in: ["QUALIFIED", "QUEUED", "APPROVED", "SENT"] } } }),
    prisma.emailDraft.count({ where: { status: "QUEUED" } }),
    prisma.emailDraft.count({ where: { status: "APPROVED" } }),
    prisma.emailDraft.count({ where: { status: { in: ["SENT", "DRY_RUN"] } } }),
    prisma.emailDraft.count({ where: { status: "FAILED" } }),
    sentCountToday(),
    getGoogleConnectionView(),
  ]);
  const resume = await loadStudentProfile();
  const settings = await getAppSettings();
  return NextResponse.json({
    discovered,
    qualified,
    queued,
    approved,
    sent,
    failed,
    daily,
    resume: resume.ok ? { ok: true, path: resume.profile.resumePath } : { ok: false, error: resume.error },
    resumeExists: resumeExists(),
    google,
    settings,
  });
}
