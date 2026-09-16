import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { getAppSettings } from "@/lib/db/settings";
import { hashResumePdf } from "@/lib/resume/hash";
import { loadStudentProfile, resolveResumePath } from "@/lib/resume/service";
import {
  formatOutreachDoc,
  formatOutreachPackage,
  outreachPackageFromDraft,
  type OutreachPackage,
} from "@/lib/bot/packages";
import {
  AUTOMATION_UNIVERSITIES,
  COLLEGES_PER_RUN,
  MAX_PACKAGES_PER_RUN,
  MAX_PROFESSORS_PER_COLLEGE,
  MIN_AUTOMATION_RELEVANCE_SCORE,
  OUTREACH_DOC_URL,
  REQUIRED_RESUME_SHA256,
} from "@/lib/bot/config";
import { filterNewPackages, loadLedger, mergeSeen, recordPackages, saveLedger } from "@/lib/bot/ledger";
import { pickNextColleges } from "@/lib/bot/rotation";
import { seenFromOutreachDoc } from "@/lib/bot/google-doc";
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

export async function listOutreachPackages(colleges?: string[]): Promise<OutreachPackage[]> {
  const resume = await loadStudentProfile();
  if (!resume.ok) throw new Error(resume.error);
  const drafts = await prisma.emailDraft.findMany({
    where: { status: { in: ["QUEUED", "APPROVED"] } },
    include: { professor: { include: { evidence: true } } },
    orderBy: { createdAt: "desc" },
  });
  const wanted = colleges?.length ? new Set(colleges) : null;
  const packages: OutreachPackage[] = [];
  for (const draft of drafts) {
    if (wanted && !wanted.has(draft.professor.university)) continue;
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
  const jsonPath = path.join(dir, "outreach-packages.json");
  const docPath = path.join(dir, "pending-google-doc.txt");
  const unsentPath = path.join(dir, "unsent-to-doc.txt");
  await writeFile(jsonPath, `${JSON.stringify(packages, null, 2)}\n`);
  await writeFile(docPath, packages.length ? `${formatOutreachDoc(packages)}\n` : "");
  if (packages.length) {
    let prior = "";
    try {
      prior = (await readFile(unsentPath, "utf8")).trim();
    } catch {
      prior = "";
    }
    const next = [prior, formatOutreachDoc(packages)].filter(Boolean).join("\n\n");
    await writeFile(unsentPath, `${next}\n`);
  }
  return { jsonPath, docPath, unsentPath };
}

export async function runOutreachBot(input: {
  send?: boolean;
  reportOnly?: boolean;
  maxCandidates?: number;
  collegesPerRun?: number;
}) {
  const resume = await loadStudentProfile();
  if (!resume.ok) {
    throw new Error(resume.error);
  }
  const resumePath = resolveResumePath();
  const resumeSha256 = await hashResumePdf(resumePath);
  if (resumeSha256 !== REQUIRED_RESUME_SHA256) {
    throw new Error(
      `Outreach bot requires saket_resume_official.pdf with SHA-256 ${REQUIRED_RESUME_SHA256}.`,
    );
  }

  const settings = await getAppSettings();
  if (!input.reportOnly && settings.AUTO_SEND) {
    throw new Error(
      "Discovery is non-sending. Disable AUTO_SEND before crawling; use --report --send only after approvals are complete.",
    );
  }
  if (input.send && !input.reportOnly) {
    throw new Error("Live send requires --report --send so discovery cannot trigger provider calls.");
  }

  let ledger = mergeSeen(await loadLedger(), await seenFromOutreachDoc());
  const batch = pickNextColleges(ledger, input.collegesPerRun ?? COLLEGES_PER_RUN);

  if (!input.reportOnly) {
    if (!batch.colleges.length) {
      throw new Error("Every college in the Top 100 catalog already has 15 professors in the Google Doc.");
    }
    const { runDiscovery } = await import("@/lib/research/pipeline");
    await runDiscovery({
      preset: "custom",
      universities: batch.colleges,
      department: "Computer Science",
      seedUrls: [],
      researchInterests: SAKET_INTERESTS,
      maxCandidates: input.maxCandidates ?? 120,
      maxCandidatesPerUniversity: Math.min(MAX_PROFESSORS_PER_COLLEGE, 3),
      minScore: MIN_AUTOMATION_RELEVANCE_SCORE,
    });
    ledger = { ...ledger, nextCollegeIndex: batch.nextCollegeIndex };
  }

  const discovered = await listOutreachPackages(input.reportOnly ? undefined : batch.colleges);
  const packages = filterNewPackages(discovered, ledger).fresh.slice(0, MAX_PACKAGES_PER_RUN);
  ledger = recordPackages(ledger, packages);
  await saveLedger(ledger);
  const outbox = await writeOutreachOutbox(packages);
  logger.info("outreach_packages_ready", {
    count: packages.length,
    colleges: batch.colleges,
    outbox: outbox.jsonPath,
    doc: OUTREACH_DOC_URL,
  });

  if (input.send) {
    if (settings.DRY_RUN) {
      throw new Error("DRY_RUN is on. The bot will not send live Gmail. Set DRY_RUN=false in Settings only if you intend to send.");
    }
    const { sendApprovedDraft } = await import("@/lib/research/pipeline");
    const drafts = await prisma.emailDraft.findMany({
      where: {
        status: "APPROVED",
        validationPassed: true,
        professor: {
          university: { in: Array.from(AUTOMATION_UNIVERSITIES) },
          relevanceScore: { gte: MIN_AUTOMATION_RELEVANCE_SCORE },
        },
      },
      select: { id: true },
      take: 20,
    });
    for (const draft of drafts) {
      await sendApprovedDraft(draft.id);
    }
  }

  return {
    packages,
    colleges: batch.colleges,
    outbox: outbox.jsonPath,
    pendingDoc: outbox.docPath,
    unsentDoc: outbox.unsentPath,
    docUrl: OUTREACH_DOC_URL,
    resumePath,
  };
}

export function printOutreachPackages(packages: OutreachPackage[]) {
  if (!packages.length) {
    return "No new unique professors this run. The bot skipped anyone already in the Google Doc and anyone without retrieved published AI/CISTech research.";
  }
  return packages.map((pkg) => formatOutreachPackage(pkg)).join("\n\n");
}
