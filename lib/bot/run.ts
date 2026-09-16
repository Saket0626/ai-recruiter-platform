import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { getAppSettings } from "@/lib/db/settings";
import { loadStudentProfile, resolveResumePath } from "@/lib/resume/service";
import { formatOutreachPackage, outreachPackageFromDraft, type OutreachPackage } from "@/lib/bot/packages";
import { logger } from "@/lib/logging/logger";

const SAKET_INTERESTS = [
  "artificial intelligence",
  "machine learning",
  "large language models",
  "natural language processing",
  "software engineering",
  "information systems",
  "data science",
];

export async function listOutreachPackages(): Promise<OutreachPackage[]> {
  const resume = await loadStudentProfile();
  if (!resume.ok) throw new Error(resume.error);
  const drafts = await prisma.emailDraft.findMany({
    where: { status: { in: ["QUEUED", "APPROVED"] } },
    include: { professor: { include: { evidence: true } } },
    orderBy: { createdAt: "desc" },
  });
  const packages: OutreachPackage[] = [];
  for (const draft of drafts) {
    const pkg = outreachPackageFromDraft({
      professorName: draft.professor.fullName,
      college: draft.professor.university,
      professorEmail: draft.professor.email,
      evidenceUrls: draft.professor.evidence.map((item) => item.url),
      facultyPageUrl: draft.professor.facultyPageUrl,
      subject: draft.subject,
      body: draft.body,
      resumePath: resume.profile.resumePath,
    });
    if (pkg) packages.push(pkg);
  }
  return packages;
}

export async function writeOutreachOutbox(packages: OutreachPackage[]) {
  const dir = path.join(process.cwd(), "data/outbox");
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, "outreach-packages.json");
  await writeFile(dest, `${JSON.stringify(packages, null, 2)}\n`);
  return dest;
}

export async function runOutreachBot(input: { send?: boolean; reportOnly?: boolean; maxCandidates?: number }) {
  const resume = await loadStudentProfile();
  if (!resume.ok) {
    throw new Error(resume.error);
  }

  if (!input.reportOnly) {
    const { runDiscovery } = await import("@/lib/research/pipeline");
    await runDiscovery({
      preset: "top100",
      department: "Computer Science",
      seedUrls: [],
      researchInterests: SAKET_INTERESTS,
      maxCandidates: input.maxCandidates ?? 300,
      maxCandidatesPerUniversity: 3,
      minScore: 50,
    });
  }

  const packages = await listOutreachPackages();
  const outbox = await writeOutreachOutbox(packages);
  logger.info("outreach_packages_ready", { count: packages.length, outbox });

  if (input.send && packages.length) {
    const settings = await getAppSettings();
    if (settings.DRY_RUN) {
      throw new Error("DRY_RUN is on. The bot will not send live Gmail. Set DRY_RUN=false in Settings only if you intend to send.");
    }
    const { sendApprovedDraft } = await import("@/lib/research/pipeline");
    const drafts = await prisma.emailDraft.findMany({
      where: { status: "QUEUED", validationPassed: true },
      select: { id: true },
    });
    for (const draft of drafts) {
      await sendApprovedDraft(draft.id);
    }
  }

  return { packages, outbox, resumePath: resolveResumePath() };
}

export function printOutreachPackages(packages: OutreachPackage[]) {
  if (!packages.length) {
    return "No ready outreach packages yet. The bot only drafts when a professor has retrieved AI/CISTech research and publication evidence.";
  }
  return packages.map((pkg) => formatOutreachPackage(pkg)).join("\n\n");
}
