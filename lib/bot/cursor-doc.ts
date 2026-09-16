import { homedir } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { loadStudentProfile } from "@/lib/resume/service";
import { formatOutreachDoc, formatOutreachPackage, outreachPackageFromDraft, type OutreachPackage } from "@/lib/bot/packages";

export const CURSOR_DOC_PATH = path.join(homedir(), ".cursor", "outreach-drafts.txt");

export async function appendPackageToCursorDoc(pkg: OutreachPackage) {
  let prior = "";
  try {
    prior = await readFile(CURSOR_DOC_PATH, "utf8");
  } catch {
    prior = "";
  }
  const needle = `professor's email: ${pkg.professorEmail}`.toLowerCase();
  if (prior.toLowerCase().includes(needle)) return false;
  const next = [prior.trim(), formatOutreachPackage(pkg)].filter(Boolean).join("\n\n");
  await mkdir(path.dirname(CURSOR_DOC_PATH), { recursive: true });
  await writeFile(CURSOR_DOC_PATH, `${next}\n`);
  return true;
}

export async function listUniqueQueuedPackages(): Promise<OutreachPackage[]> {
  const resume = await loadStudentProfile();
  if (!resume.ok) throw new Error(resume.error);
  const drafts = await prisma.emailDraft.findMany({
    where: { status: { in: ["QUEUED", "APPROVED"] } },
    include: { professor: { include: { evidence: true } } },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<string>();
  const packages: OutreachPackage[] = [];
  for (const draft of drafts) {
    const email = (draft.professor.email || "").toLowerCase();
    if (!email || seen.has(email) || email.includes("uncomment")) continue;
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
    if (!pkg) continue;
    seen.add(email);
    packages.push(pkg);
  }
  return packages;
}

export async function syncCursorOutreachDoc() {
  const packages = await listUniqueQueuedPackages();
  await mkdir(path.dirname(CURSOR_DOC_PATH), { recursive: true });
  await writeFile(CURSOR_DOC_PATH, packages.length ? `${formatOutreachDoc(packages)}\n` : "");
  return { path: CURSOR_DOC_PATH, count: packages.length };
}
