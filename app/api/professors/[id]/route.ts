import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { publicError } from "@/lib/security/errors";
import { requireMutatingAccess } from "@/lib/security/access";
import { isGenericInbox, isValidEmailShape, normalizeEmail } from "@/lib/security/email";
import { loadStudentProfile } from "@/lib/resume/service";
import { getAppSettings } from "@/lib/db/settings";
import { validateEmailDraft } from "@/lib/validation/email-quality";

const professorPatchSchema = z.object({
  email: z.string().trim().email().optional(),
  allowGenericInbox: z.boolean().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const professor = await prisma.professor.findUnique({
    where: { id },
    include: { evidence: true, drafts: { orderBy: { createdAt: "desc" } }, sends: true },
  });
  if (!professor) return NextResponse.json({ error: "Professor not found" }, { status: 404 });
  return NextResponse.json({ professor });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = requireMutatingAccess(request);
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const parsed = professorPatchSchema.parse(await request.json());
    const existing = await prisma.professor.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Professor not found" }, { status: 404 });
    const email = parsed.email ? normalizeEmail(parsed.email) : existing.email;
    if (email && !isValidEmailShape(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    const genericInbox = email ? isGenericInbox(email) : false;
    const professor = await prisma.professor.update({
      where: { id },
      data: {
        email,
        emailNormalized: email,
        genericInbox,
        allowGenericInbox: parsed.allowGenericInbox ?? existing.allowGenericInbox,
      },
    });

    const latest = await prisma.emailDraft.findFirst({
      where: { professorId: id, status: { in: ["QUEUED", "APPROVED", "VALIDATION_FAILED"] } },
      include: { professor: { include: { evidence: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (latest) {
      const resume = await loadStudentProfile();
      const settings = await getAppSettings();
      const topics = JSON.parse(latest.professor.researchTopics || "[]") as string[];
      const failures = resume.ok
        ? validateEmailDraft({
            professorName: latest.professor.fullName,
            professorEmail: professor.email,
            subject: latest.subject,
            body: latest.body,
            topics,
            evidenceTexts: latest.professor.evidence.map((item) => item.extractedText),
            evidenceUrls: latest.professor.evidence.map((item) => item.url),
            student: resume.profile,
            resumeAvailable: true,
            relevanceScore: latest.professor.relevanceScore ?? 0,
            minScore: settings.MIN_RELEVANCE_SCORE,
            insufficientEvidence: latest.professor.insufficientEvidence,
            allowGenericInbox: professor.allowGenericInbox,
            availabilitySentence: settings.AVAILABILITY_SENTENCE,
          })
        : [{ code: "missing_resume", message: resume.error }];
      await prisma.emailDraft.update({
        where: { id: latest.id },
        data: {
          status: failures.length ? "VALIDATION_FAILED" : "QUEUED",
          approvedAt: null,
          resumeSha256: null,
          contentSha256: null,
          validationPassed: failures.length === 0,
          validationErrors: JSON.stringify(failures),
          failureReason: failures[0]?.message,
        },
      });
    }

    return NextResponse.json({ professor });
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
}
