import { prisma } from "@/lib/db/prisma";
import { getAppSettings } from "@/lib/db/settings";
import { generateGroundedEmail } from "@/lib/email/generator";
import { looksLikePersonName } from "@/lib/research/parser";
import { loadStudentProfile } from "@/lib/resume/service";
import { formatOutreachPackage, outreachPackageFromDraft } from "@/lib/bot/packages";

const KEEP = ["divyagrawal@ucsb.edu", "amr@cs.ucsb.edu"];

async function main() {
  const resume = await loadStudentProfile();
  if (!resume.ok) throw new Error(resume.error);
  const settings = await getAppSettings();

  await prisma.emailDraft.updateMany({
    where: {
      OR: [
        { professor: { fullName: { contains: "Personal Website" } } },
        { body: { contains: "Hello Dr. Website" } },
      ],
      status: { in: ["QUEUED", "APPROVED"] },
    },
    data: {
      status: "REJECTED",
      failureReason: "Parser mixed Personal Website link text with a faculty profile. Do not send.",
    },
  });

  for (const email of KEEP) {
    const professor = await prisma.professor.findFirst({
      where: { OR: [{ email }, { emailNormalized: email }] },
      include: { evidence: true, drafts: { where: { status: { in: ["QUEUED", "APPROVED"] } } } },
    });
    if (!professor || !looksLikePersonName(professor.fullName)) continue;
    const topics = JSON.parse(professor.researchTopics || "[]") as string[];
    const evidenceTexts = professor.evidence.map((row) => row.extractedText).filter(Boolean);
    if (!topics.length || !evidenceTexts.length) continue;
    const emailDraft = generateGroundedEmail({
      professorLastName: professor.lastName,
      professorFullName: professor.fullName,
      topics,
      researchSummary: professor.researchSummary || topics.join(", "),
      student: resume.profile,
      evidenceTexts,
      availabilitySentence: settings.AVAILABILITY_SENTENCE,
    });
    const existing = professor.drafts[0];
    if (existing) {
      await prisma.emailDraft.update({
        where: { id: existing.id },
        data: {
          subject: emailDraft.subject,
          body: emailDraft.body,
          personalizedTopics: JSON.stringify(emailDraft.personalized_topics),
          studentClaims: JSON.stringify(emailDraft.student_claims),
          contentSha256: null,
        },
      });
    }
    const pkg = outreachPackageFromDraft({
      professorName: professor.fullName,
      college: professor.university,
      professorEmail: professor.email,
      evidenceUrls: professor.evidence.map((row) => row.url),
      facultyPageUrl: professor.facultyPageUrl,
      subject: emailDraft.subject,
      body: emailDraft.body,
      resumePath: resume.profile.resumePath,
    });
    if (pkg) console.log(`${formatOutreachPackage(pkg)}\n`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
