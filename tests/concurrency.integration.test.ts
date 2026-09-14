import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { PrismaClient } from "@prisma/client";
import { resetEnvCache } from "@/lib/config/env";

const runDb = process.env.RUN_DB_INTEGRATION === "1";

vi.mock("@/lib/email/create-provider", () => ({
  createEmailProvider: () => ({
    sendResearchEmail: async () => ({ ok: true, dryRun: false, graphStatus: "201" }),
  }),
}));

vi.mock("@/lib/resume/service", async () => {
  const { parseResumeText } = await import("@/lib/resume/parser");
  const profile = parseResumeText(
    `SAKET
EXPERIENCE
ClinicalHours
Helped with the development of the ClinicalHours website, using AI to help with development.
PROJECTS
Canvas Companion
Helped build syllabus extraction and LLM parsing features using TypeScript.
ChartWise
Helped with a market data pipeline using SQL.
Cloud of Goods
Contributed to a web project using React.
TECHNICAL SKILLS
Python TypeScript Linux Wireshark cybersecurity
`,
    "data/fixtures/starter-resume.pdf",
  );
  return {
    resolveResumePath: () => process.env.RESUME_PATH || "data/fixtures/starter-resume.pdf",
    resumeExists: () => true,
    loadStudentProfile: async () => ({ ok: true as const, profile }),
  };
});

async function writeResume(dir: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([400, 400]);
  page.drawText("Saket fixture resume for concurrent send tests", { x: 24, y: 300, size: 12 });
  const dest = path.join(dir, "resume.pdf");
  writeFileSync(dest, await pdf.save());
  return dest;
}

describe.skipIf(!runDb)("concurrent postgres send reservations", () => {
  const prisma = new PrismaClient();
  const ids: string[] = [];
  let resumeDir = "";

  beforeAll(async () => {
    await prisma.$connect();
    resumeDir = path.join(os.tmpdir(), `rr-concurrent-${Date.now()}`);
    mkdirSync(resumeDir, { recursive: true });
    const resumePath = await writeResume(resumeDir);
    vi.stubEnv("RESUME_PATH", resumePath);
    vi.stubEnv("DRY_RUN", "false");
    vi.stubEnv("AUTO_SEND", "false");
    vi.stubEnv("EMAIL_PROVIDER", "gmail");
    resetEnvCache();
  });

  afterAll(async () => {
    if (ids.length) {
      await prisma.emailSend.deleteMany({ where: { professorId: { in: ids } } });
      await prisma.emailDraft.deleteMany({ where: { professorId: { in: ids } } });
      await prisma.researchEvidence.deleteMany({ where: { professorId: { in: ids } } });
      await prisma.professor.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it("lets only one of two concurrent live sends succeed when the daily cap is 1", async () => {
    const { hashResumePdf } = await import("@/lib/resume/hash");
    const { sendApprovedDraft } = await import("@/lib/research/pipeline");
    const resumeHash = await hashResumePdf(process.env.RESUME_PATH!);

    async function seedDraft(email: string) {
      const professor = await prisma.professor.create({
        data: {
          firstName: "Test",
          lastName: "Professor",
          fullName: `Test Professor ${email}`,
          university: "Test University",
          email,
          emailNormalized: email,
          researchTopics: JSON.stringify(["software security"]),
          researchSummary: "software security",
          status: "APPROVED",
          identityKey: `email:${email}:${randomUUID()}`,
          relevanceScore: 90,
          insufficientEvidence: false,
          evidence: {
            create: {
              url: "https://cs.example.edu/faculty/test",
              extractedText:
                "The lab investigates binary rewriting defenses against return-oriented programming attacks. Software security and program analysis are used to harden binaries.",
              claim: "software security research",
              sourcePriority: 1,
            },
          },
        },
      });
      ids.push(professor.id);
      return prisma.emailDraft.create({
        data: {
          professorId: professor.id,
          subject: "Undergraduate Research Interest in Software Security",
          body: [
            "Hello Dr. Professor,",
            "",
            "My name is Saket, and I am a first-year student at UT Dallas interested in pursuing Computer Information Systems and Technology. I am interested in your research on software security. I would love to learn more about your lab's work on binary rewriting defenses against return-oriented programming attacks and see if I am able to assist with your research this year.",
            "",
            "I recently helped with the development of the ClinicalHours website, using AI to help with development, and became fascinated by how technology affects the way people and organizations use and share information.",
            "",
            "My work on ClinicalHours made me curious about binary rewriting defenses against return-oriented programming attacks. I am eager to gain experience in your lab, applying my background in technology to help investigate software security while learning more about software security. I have attached my resume for your review. I am available to start immediately and continue through the spring and beyond. I can contribute a few hours each week and I am hoping to learn how your group approaches this work in practice. Thank you for your time and consideration!",
            "",
            "Sincerely,",
            "Saket",
          ].join("\n"),
          status: "APPROVED",
          validationPassed: true,
          approvedAt: new Date(),
          resumeSha256: resumeHash,
        },
      });
    }

    const first = await seedDraft(`one.${randomUUID()}@cs.example.edu`);
    const second = await seedDraft(`two.${randomUUID()}@cs.example.edu`);
    const results = await Promise.allSettled([sendApprovedDraft(first.id), sendApprovedDraft(second.id)]);
    const fulfilled = results.filter((item) => item.status === "fulfilled");
    const rejected = results.filter((item) => item.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(/daily email cap/i);
  });
});
