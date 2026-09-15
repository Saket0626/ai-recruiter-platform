import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { publicError } from "@/lib/security/errors";
import { requireMutatingAccess } from "@/lib/security/access";
import { generateGroundedEmail } from "@/lib/email/generator";
import { loadStudentProfile, resolveResumePath, resumeExists } from "@/lib/resume/service";
import { hashResumePdf, hashDraftContent } from "@/lib/resume/hash";
import { sendApprovedDraft } from "@/lib/research/pipeline";
import { logger } from "@/lib/logging/logger";
import { validateEmailDraft } from "@/lib/validation/email-quality";
import { getAppSettings } from "@/lib/db/settings";

async function getDraft(id: string) {
  return prisma.emailDraft.findUnique({
    where: { id },
    include: { professor: { include: { evidence: true } } },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = requireMutatingAccess(request);
  if (denied) return denied;
  const { id } = await context.params;
  const body = await request.json();
  const existing = await getDraft(id);
  if (!existing) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  const subject = typeof body.subject === "string" ? body.subject : existing.subject;
  const text = typeof body.body === "string" ? body.body : existing.body;
  const resume = await loadStudentProfile();
  const settings = await getAppSettings();
  const topics = JSON.parse(existing.professor.researchTopics || "[]") as string[];
  const failures = resume.ok
    ? validateEmailDraft({
        professorName: existing.professor.fullName,
        professorEmail: existing.professor.email,
        subject,
        body: text,
        topics,
        evidenceTexts: existing.professor.evidence.map((item) => item.extractedText),
        evidenceUrls: existing.professor.evidence.map((item) => item.url),
        student: resume.profile,
        resumeAvailable: true,
        relevanceScore: existing.professor.relevanceScore ?? 0,
        minScore: settings.MIN_RELEVANCE_SCORE,
        insufficientEvidence: existing.professor.insufficientEvidence,
        allowGenericInbox: existing.professor.allowGenericInbox,
        availabilitySentence: settings.AVAILABILITY_SENTENCE,
      })
    : [{ code: "missing_resume", message: resume.error }];
  const draft = await prisma.emailDraft.update({
    where: { id },
    data: {
      subject,
      body: text,
      status: failures.length ? "VALIDATION_FAILED" : "QUEUED",
      approvedAt: null,
      resumeSha256: null,
      contentSha256: null,
      validationPassed: failures.length === 0,
      validationErrors: JSON.stringify(failures),
      failureReason: failures[0]?.message,
    },
  });
  return NextResponse.json({ draft });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = requireMutatingAccess(request);
  if (denied) return denied;
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  try {
    const draft = await getDraft(id);
    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

    if (action === "approve") {
      if (!["QUEUED", "APPROVED"].includes(draft.status) || !draft.validationPassed) {
        return NextResponse.json({ error: "Only validated queued drafts can be approved." }, { status: 400 });
      }
      const resumePath = resolveResumePath();
      if (!resumeExists(resumePath)) {
        return NextResponse.json({ error: "Resume PDF is missing. Sending is disabled." }, { status: 400 });
      }
      const resumeHash = await hashResumePdf(resumePath);
      const updated = await prisma.emailDraft.update({
        where: { id },
        data: { status: "APPROVED", approvedAt: new Date(), resumeSha256: resumeHash, contentSha256: hashDraftContent(draft.subject, draft.body) },
      });
      await prisma.professor.update({ where: { id: draft.professorId }, data: { status: "APPROVED" } });
      logger.info("approval", { draftId: id, professorId: draft.professorId });
      return NextResponse.json({ draft: updated });
    }
    if (action === "reject") {
      const updated = await prisma.emailDraft.update({
        where: { id },
        data: { status: "REJECTED", rejectedAt: new Date(), approvedAt: null, resumeSha256: null, contentSha256: null },
      });
      await prisma.professor.update({ where: { id: draft.professorId }, data: { status: "REJECTED" } });
      return NextResponse.json({ draft: updated });
    }
    if (action === "regenerate") {
      const resume = await loadStudentProfile();
      if (!resume.ok) return NextResponse.json({ error: resume.error }, { status: 400 });
      const settings = await getAppSettings();
      const topics = JSON.parse(draft.professor.researchTopics || "[]") as string[];
      const generated = generateGroundedEmail({
        professorLastName: draft.professor.lastName,
        professorFullName: draft.professor.fullName,
        topics,
        researchSummary: draft.professor.researchSummary ?? "",
        student: resume.profile,
        evidenceTexts: draft.professor.evidence.map((item) => item.extractedText),
        availabilitySentence: settings.AVAILABILITY_SENTENCE,
      });
      const failures = validateEmailDraft({
        professorName: draft.professor.fullName,
        professorEmail: draft.professor.email,
        subject: generated.subject,
        body: generated.body,
        topics,
        evidenceTexts: draft.professor.evidence.map((item) => item.extractedText),
        evidenceUrls: draft.professor.evidence.map((item) => item.url),
        student: resume.profile,
        resumeAvailable: true,
        relevanceScore: draft.professor.relevanceScore ?? 0,
        minScore: settings.MIN_RELEVANCE_SCORE,
        insufficientEvidence: draft.professor.insufficientEvidence,
        allowGenericInbox: draft.professor.allowGenericInbox,
        availabilitySentence: settings.AVAILABILITY_SENTENCE,
      });
      const updated = await prisma.emailDraft.update({
        where: { id },
        data: {
          subject: generated.subject,
          body: generated.body,
          personalizedTopics: JSON.stringify(generated.personalized_topics),
          studentClaims: JSON.stringify(generated.student_claims),
          validationErrors: JSON.stringify(failures),
          validationPassed: failures.length === 0,
          status: failures.length ? "VALIDATION_FAILED" : "QUEUED",
          failureReason: failures[0]?.message,
          approvedAt: null,
          resumeSha256: null,
          contentSha256: null,
        },
      });
      return NextResponse.json({ draft: updated });
    }
    if (action === "send") {
      const send = await sendApprovedDraft(id);
      return NextResponse.json({ send });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
}
