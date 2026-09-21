import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { getAppSettings } from "@/lib/db/settings";
import { loadStudentProfile, resolveResumePath } from "@/lib/resume/service";
import {
  formatOutreachPackage,
  outreachPackageFromDraft,
  type OutreachPackage,
} from "@/lib/bot/packages";
import {
  COLLEGES_PER_RUN,
  MAX_PACKAGES_PER_RUN,
  MAX_PROFESSORS_PER_COLLEGE,
  UTD_DEEP_CANDIDATES,
} from "@/lib/bot/config";
import { seenFromCursorDoc, syncCursorOutreachDoc } from "@/lib/bot/cursor-doc";
import { filterNewPackages, loadLedger, mergeSeen, recordPackages, saveLedger } from "@/lib/bot/ledger";
import { californiaTexasRotationColleges, pickNextColleges, texasRotationColleges } from "@/lib/bot/rotation";
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
  await writeFile(jsonPath, `${JSON.stringify(packages, null, 2)}\n`);
  const synced = await syncCursorOutreachDoc();
  return { jsonPath, docPath: synced.path, count: synced.count };
}

export async function runOutreachBot(input: {
  send?: boolean;
  reportOnly?: boolean;
  maxCandidates?: number;
  collegesPerRun?: number;
  texasOnly?: boolean;
  californiaTexasOnly?: boolean;
  utdOnly?: boolean;
}) {
  const resume = await loadStudentProfile();
  if (!resume.ok) {
    throw new Error(resume.error);
  }

  const regionalOnly = Boolean(input.texasOnly || input.californiaTexasOnly);
  let ledger = mergeSeen(await loadLedger(), await seenFromCursorDoc());
  const batch = input.utdOnly
    ? { colleges: ["University of Texas at Dallas"], nextCollegeIndex: ledger.nextCollegeIndex }
    : input.californiaTexasOnly
      ? pickNextColleges(ledger, input.collegesPerRun ?? COLLEGES_PER_RUN, {
          catalog: californiaTexasRotationColleges(),
          startIndex: 0,
          requireCapacity: false,
        })
      : input.texasOnly
        ? pickNextColleges(ledger, input.collegesPerRun ?? COLLEGES_PER_RUN, {
            catalog: texasRotationColleges(),
            startIndex: 0,
            requireCapacity: false,
          })
        : pickNextColleges(ledger, input.collegesPerRun ?? COLLEGES_PER_RUN);

  if (!input.reportOnly) {
    if (!batch.colleges.length) {
      throw new Error(
        input.californiaTexasOnly
          ? "No California or Texas colleges were found in the university catalog."
          : input.texasOnly
          ? "No Texas colleges were found in the university catalog."
          : "Every college in the Top 100 catalog already has 15 professors in outreach-drafts.txt.",
      );
    }
    const { runDiscovery } = await import("@/lib/research/pipeline");
    await runDiscovery({
      preset: "custom",
      universities: batch.colleges,
      department: "Computer Science",
      seedUrls: [],
      researchInterests: SAKET_INTERESTS,
      maxCandidates: input.utdOnly
        ? MAX_PROFESSORS_PER_COLLEGE
        : (input.maxCandidates ?? COLLEGES_PER_RUN * MAX_PROFESSORS_PER_COLLEGE),
      maxCandidatesPerUniversity: input.utdOnly ? UTD_DEEP_CANDIDATES : MAX_PROFESSORS_PER_COLLEGE,
      minScore: 50,
    });
    if (!regionalOnly && !input.utdOnly) {
      ledger = { ...ledger, nextCollegeIndex: batch.nextCollegeIndex };
    }
  }

  const discovered = await listOutreachPackages(input.reportOnly ? undefined : batch.colleges);
  const capOptions = regionalOnly || input.utdOnly ? { ignoreCollegeCap: true } : undefined;
  const packages = filterNewPackages(discovered, ledger, capOptions).fresh.slice(0, MAX_PACKAGES_PER_RUN);
  ledger = recordPackages(ledger, packages, capOptions);
  await saveLedger(ledger);
  const outbox = await writeOutreachOutbox(packages);
  logger.info("outreach_packages_ready", {
    count: packages.length,
    colleges: batch.colleges,
    outbox: outbox.jsonPath,
    doc: outbox.docPath,
  });

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

  return {
    packages,
    colleges: batch.colleges,
    outbox: outbox.jsonPath,
    pendingDoc: outbox.docPath,
    resumePath: resolveResumePath(),
  };
}

export function printOutreachPackages(packages: OutreachPackage[]) {
  if (!packages.length) {
    return "No new unique professors this run. The bot skipped anyone already in outreach-drafts.txt and anyone without retrieved published AI/CISTech research.";
  }
  return packages.map((pkg) => formatOutreachPackage(pkg)).join("\n\n");
}
