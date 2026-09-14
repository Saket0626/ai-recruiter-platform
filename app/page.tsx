import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { sentCountToday } from "@/lib/email/rate-limit";
import { loadStudentProfile } from "@/lib/resume/service";
import { getAppSettings } from "@/lib/db/settings";
import { StatCard } from "@/components/StatCard";
import { getGoogleConnectionView } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [discovered, qualified, queued, approved, sent, failed, daily, resume, settings, google] = await Promise.all([
    prisma.professor.count(),
    prisma.professor.count({ where: { status: { in: ["QUALIFIED", "QUEUED", "APPROVED", "SENT"] } } }),
    prisma.emailDraft.count({ where: { status: { in: ["QUEUED", "VALIDATION_FAILED"] } } }),
    prisma.emailDraft.count({ where: { status: "APPROVED" } }),
    prisma.emailSend.count({ where: { status: { in: ["SENT", "DRY_RUN"] } } }),
    prisma.emailSend.count({ where: { status: "FAILED" } }),
    sentCountToday(),
    loadStudentProfile(),
    getAppSettings(),
    getGoogleConnectionView(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-sm uppercase tracking-[0.18em] text-muted">Overview</p>
        <h1 className="mt-1 text-3xl font-semibold">ResearchReach dashboard</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Discover professors across the top 100 U.S. universities and other research schools, keep every research claim tied to a retrieved page, and send approved notes through Gmail.
        </p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Professors discovered" value={discovered} />
        <StatCard label="Qualified" value={qualified} />
        <StatCard label="Awaiting review" value={queued} />
        <StatCard label="Approved" value={approved} />
        <StatCard label="Sent" value={sent} hint={settings.DRY_RUN ? "DRY_RUN is on" : "Live Gmail sending"} />
        <StatCard label="Failed sends" value={failed} />
        <StatCard label="Sent today" value={`${daily}/${settings.MAX_EMAILS_PER_DAY}`} />
        <StatCard label="Autopilot" value={settings.AUTO_SEND ? "On" : "Off"} hint={`Threshold ${settings.AUTOPILOT_MIN_SCORE}`} />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rr-card p-5">
          <h2 className="font-semibold">Resume</h2>
          {resume.ok ? (
            <p className="mt-2 text-sm text-muted">Loaded from {resume.profile.resumePath}. Sending can attach this PDF.</p>
          ) : (
            <p className="mt-2 text-sm text-[#9f1239]">{resume.error}</p>
          )}
        </div>
        <div className="rr-card p-5">
          <h2 className="font-semibold">Gmail</h2>
          <p className="mt-2 text-sm text-muted">
            {google.connected
              ? `Connected as ${google.email}. Send scope: ${google.hasSendScope ? "granted" : "missing"}`
              : google.configured
                ? "Not connected yet."
                : "Google OAuth client is not configured."}
          </p>
          <Link className="rr-btn rr-btn-ghost mt-4" href="/settings">Open settings</Link>
        </div>
      </section>
    </div>
  );
}
