import { prisma } from "@/lib/db/prisma";
import { upsertProfessor } from "@/lib/db/professors";
import { getAppSettings } from "@/lib/db/settings";
import { DEFAULT_RESEARCH_KEYWORDS } from "@/lib/config/defaults";
import { logger } from "@/lib/logging/logger";
import { analyzeProfessorResearch } from "@/lib/research/analyzer";
import { FallbackResearchProvider } from "@/lib/research/crawler";
import { extractFacultyFromDirectory, extractProfileDetails, sourcePriority } from "@/lib/research/parser";
import { scoreProfessorRelevance } from "@/lib/research/scorer";
import { CompositeSearchProvider } from "@/lib/search/composite";
import { generateGroundedEmail } from "@/lib/email/generator";
import { createEmailProvider } from "@/lib/email/create-provider";
import { dailyCapReached, isInCooldown, jitterDelayMs } from "@/lib/email/rate-limit";
import { assertDraftSendable, professorStatusAfterSend } from "@/lib/email/send-gate";
import { loadStudentProfile, resolveResumePath, resumeExists } from "@/lib/resume/service";
import { isGenericInbox, normalizeEmail, normalizeUrl } from "@/lib/security/email";
import { resolveUniversitySelections, type ResolvedUniversity } from "@/lib/universities/catalog";
import { discoveryInputSchema, type DiscoveryInput, type StudentProfile } from "@/lib/validation/schemas";
import { validateEmailDraft } from "@/lib/validation/email-quality";

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateRun(id: string, data: { currentStage: string; status?: string; progressJson?: string; errorMessage?: string }) {
  await prisma.discoveryRun.update({ where: { id }, data });
}

type Progress = {
  discovered: number;
  researched: number;
  qualified: number;
  queued: number;
  universitiesTotal: number;
  universitiesDone: number;
  currentUniversity: string;
};

function perUniversityCap(input: DiscoveryInput, universityCount: number) {
  if (universityCount <= 1) return input.maxCandidates;
  const fairShare = Math.max(1, Math.floor(input.maxCandidates / universityCount));
  return Math.min(input.maxCandidatesPerUniversity, Math.max(fairShare, 3));
}

export async function runDiscovery(raw: DiscoveryInput) {
  const run = await startDiscoveryRun(raw);
  return executeDiscovery(run.id);
}

export async function startDiscoveryRun(raw: DiscoveryInput) {
  const input = discoveryInputSchema.parse(raw);
  const universities = resolveUniversitySelections(input);
  const keywords = input.researchInterests.length ? input.researchInterests : DEFAULT_RESEARCH_KEYWORDS;
  const label =
    universities.length === 1
      ? universities[0]!.name
      : `${universities.length} universities (${universities[0]!.name} + ${universities.length - 1} more)`;
  const run = await prisma.discoveryRun.create({
    data: {
      university: label,
      universitiesJson: JSON.stringify(universities.map((university) => university.name)),
      department: input.department,
      universityDomain: universities.map((university) => university.domain).join(","),
      seedUrls: JSON.stringify(universities.flatMap((university) => university.seedUrls)),
      researchInterests: JSON.stringify(keywords),
      maxCandidates: input.maxCandidates,
      minScore: input.minScore,
      status: "RUNNING",
      currentStage: "DISCOVER",
      progressJson: JSON.stringify({
        discovered: 0,
        researched: 0,
        qualified: 0,
        queued: 0,
        universitiesTotal: universities.length,
        universitiesDone: 0,
        currentUniversity: universities[0]?.name ?? "",
      } satisfies Progress),
    },
  });
  logger.info("discovery_started", {
    runId: run.id,
    universities: universities.length,
    names: universities.slice(0, 8).map((university) => university.name),
  });
  return run;
}

export async function executeDiscovery(runId: string) {
  const run = await prisma.discoveryRun.findUniqueOrThrow({ where: { id: runId } });
  const names = JSON.parse(run.universitiesJson || "[]") as string[];
  const universities = resolveUniversitySelections({
    universities: names.length ? names : [run.university],
    department: run.department ?? undefined,
  });
  const keywords = JSON.parse(run.researchInterests || "[]") as string[];
  const input = discoveryInputSchema.parse({
    universities: universities.map((university) => university.name),
    department: run.department,
    researchInterests: keywords,
    maxCandidates: run.maxCandidates,
    minScore: run.minScore,
  });

  try {
    const resume = await loadStudentProfile();
    if (!resume.ok) {
      throw new Error(resume.error);
    }
    const student = resume.profile;
    const research = new FallbackResearchProvider();
    const progress: Progress = {
      discovered: 0,
      researched: 0,
      qualified: 0,
      queued: 0,
      universitiesTotal: universities.length,
      universitiesDone: 0,
      currentUniversity: universities[0]?.name ?? "",
    };
    const capPerSchool = perUniversityCap(input, universities.length);

    for (const university of universities) {
      if (progress.discovered >= input.maxCandidates) break;
      progress.currentUniversity = university.name;
      await updateRun(run.id, {
        currentStage: `DISCOVER:${university.shortName}`,
        progressJson: JSON.stringify(progress),
      });
      await discoverOneUniversity({
        university,
        keywords,
        student,
        minScore: input.minScore,
        runId: run.id,
        research,
        remaining: Math.min(capPerSchool, input.maxCandidates - progress.discovered),
        progress,
      });
      progress.universitiesDone += 1;
      await updateRun(run.id, {
        currentStage: "RESEARCH",
        progressJson: JSON.stringify(progress),
      });
    }

    await updateRun(run.id, {
      currentStage: "DONE",
      status: "COMPLETED",
      progressJson: JSON.stringify(progress),
    });
    logger.info("discovery_completed", { runId: run.id, ...progress });
    return prisma.discoveryRun.findUniqueOrThrow({ where: { id: run.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery failed";
    logger.error("discovery_failed", { runId: run.id, error: message });
    await updateRun(run.id, { currentStage: "FAILED", status: "FAILED", errorMessage: message });
    throw error;
  }
}

async function discoverOneUniversity(input: {
  university: ResolvedUniversity;
  keywords: string[];
  student: StudentProfile;
  minScore: number;
  runId: string;
  research: FallbackResearchProvider;
  remaining: number;
  progress: Progress;
}) {
  if (input.remaining <= 0) return;
  const search = new CompositeSearchProvider(input.university.seedUrls);
  const hits = await search.searchFaculty({
    university: input.university.name,
    domain: input.university.domain,
    keywords: input.keywords,
    maxResults: input.remaining,
  });

  const seen = new Set<string>();
  const peopleQueue: Array<{
    fullName: string;
    firstName: string;
    lastName: string;
    title: string | null;
    email: string | null;
    emailSourceUrl: string | null;
    facultyPageUrl: string | null;
    labUrl: string | null;
    personalWebsite: string | null;
    snippet: string;
  }> = [];

  for (const seed of input.university.seedUrls) {
    const pages = await input.research.retrieve([seed]);
    for (const page of pages) {
      for (const person of extractFacultyFromDirectory(page.html, page.url, input.university.domain)) {
        const key = (person.email || person.facultyPageUrl || person.fullName).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        peopleQueue.push(person);
      }
    }
  }

  for (const url of [...new Set(hits.map((hit) => hit.url).filter(Boolean))]) {
    if (peopleQueue.length >= input.remaining) break;
    const pages = await input.research.retrieve([url]);
    const page = pages[0];
    if (!page) continue;
    const people = extractFacultyFromDirectory(page.html, page.url, input.university.domain);
    const fallbackPerson =
      people[0] ?? nameFromHit(hits.find((hit) => hit.url === url)?.title ?? "", page.url, input.university.domain, page.text);
    if (!fallbackPerson) continue;
    const key = (fallbackPerson.email || fallbackPerson.facultyPageUrl || fallbackPerson.fullName).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    peopleQueue.push(fallbackPerson);
  }

  for (const person of peopleQueue.slice(0, input.remaining)) {
    const result = await persistAndResearch({
      person,
      university: input.university.name,
      department: input.university.department,
      domain: input.university.domain,
      student: input.student,
      minScore: input.minScore,
      runId: input.runId,
      research: input.research,
    });
    input.progress.discovered += 1;
    if (result.researched) input.progress.researched += 1;
    if (result.qualified) input.progress.qualified += 1;
    if (result.queued) input.progress.queued += 1;
  }
}

function nameFromHit(title: string, url: string, domain: string, text: string) {
  const cleaned = title.replace(/[-|].*$/, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) return null;
  const emailMatch = text.match(new RegExp(`[A-Z0-9._%+-]+@[\\w.-]*${domain.replace(".", "\\.")}`, "i"));
  return {
    fullName: cleaned,
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
    title: null,
    email: emailMatch?.[0] ?? null,
    emailSourceUrl: emailMatch ? url : null,
    facultyPageUrl: url,
    labUrl: null,
    personalWebsite: null,
    snippet: text.slice(0, 400),
  };
}

async function persistAndResearch(input: {
  person: {
    fullName: string;
    firstName: string;
    lastName: string;
    title: string | null;
    email: string | null;
    emailSourceUrl: string | null;
    facultyPageUrl: string | null;
    labUrl: string | null;
    personalWebsite: string | null;
    snippet: string;
  };
  university: string;
  department: string;
  domain: string;
  student: StudentProfile;
  minScore: number;
  runId: string;
  research: FallbackResearchProvider;
}) {
  const professor = await upsertProfessor({
    ...input.person,
    department: input.department,
    university: input.university,
    status: "DISCOVERED",
  });
  logger.info("professor_discovered", { professorId: professor.id, name: professor.fullName, university: input.university });

  const urls = [
    professor.facultyPageUrl,
    professor.labUrl,
    professor.personalWebsite,
  ].filter((url): url is string => Boolean(url && normalizeUrl(url)));

  const pages = urls.length ? await input.research.retrieve(urls) : [];
  if (!pages.length && professor.facultyPageUrl) {
    return { researched: false, qualified: false, queued: false };
  }

  const evidenceRows = [];
  let combinedText = input.person.snippet;
  for (const page of pages) {
    const details = extractProfileDetails(page.html, page.url, input.domain);
    combinedText += `\n${details.text}`;
    if (!professor.email && details.email) {
      await prisma.professor.update({
        where: { id: professor.id },
        data: {
          email: details.email,
          emailNormalized: normalizeEmail(details.email),
          emailSourceUrl: details.emailSourceUrl,
          labUrl: professor.labUrl ?? details.labUrl,
          personalWebsite: professor.personalWebsite ?? details.personalWebsite,
        },
      });
    }
    evidenceRows.push({
      professorId: professor.id,
      url: page.url,
      title: page.title,
      extractedText: details.text.slice(0, 20000),
      claim: "Retrieved public academic page",
      sourcePriority: sourcePriority(page.url, input.domain),
    });
  }
  if (evidenceRows.length) {
    await prisma.researchEvidence.createMany({ data: evidenceRows });
  }

  const analysis = await analyzeProfessorResearch({
    professorName: professor.fullName,
    sources: pages.map((page) => ({ url: page.url, title: page.title, text: page.text })),
    student: input.student,
  });
  const scored = scoreProfessorRelevance({
    pageText: combinedText,
    student: input.student,
    hasCurrentActivity: analysis.current_projects.length > 0 || /202[3-9]|2026/.test(combinedText),
  });
  const insufficient = analysis.insufficient_evidence || analysis.research_topics.length === 0 || scored.score < 20;
  const status = insufficient ? "INSUFFICIENT_EVIDENCE" : scored.score >= input.minScore ? "QUALIFIED" : "RESEARCHED";

  await prisma.professor.update({
    where: { id: professor.id },
    data: {
      researchTopics: JSON.stringify(analysis.research_topics),
      researchSummary: analysis.research_summary,
      currentProjects: JSON.stringify(analysis.current_projects),
      relevanceScore: insufficient ? scored.score : Math.round((scored.score + analysis.relevance_score) / 2),
      relevanceExplanation: analysis.relevance_reason || scored.explanation,
      scoringFactors: JSON.stringify(scored.factors),
      insufficientEvidence: insufficient,
      genericInbox: professor.email ? isGenericInbox(professor.email) : false,
      status,
    },
  });
  logger.info("research_completed", { professorId: professor.id, status, score: scored.score });

  if (insufficient || scored.score < input.minScore) {
    logger.info("qualification_result", { professorId: professor.id, qualified: false, reason: status });
    return { researched: true, qualified: false, queued: false };
  }

  logger.info("qualification_result", { professorId: professor.id, qualified: true });
  const email = generateGroundedEmail({
    professorLastName: professor.lastName,
    professorFullName: professor.fullName,
    topics: analysis.research_topics,
    researchSummary: analysis.research_summary,
    student: input.student,
  });
  const latest = await prisma.professor.findUniqueOrThrow({ where: { id: professor.id } });
  const failures = validateEmailDraft({
    professorName: latest.fullName,
    professorEmail: latest.email,
    subject: email.subject,
    body: email.body,
    topics: analysis.research_topics,
    evidenceTexts: evidenceRows.map((row) => row.extractedText),
    evidenceUrls: evidenceRows.map((row) => row.url),
    student: input.student,
    resumeAvailable: resumeExists(),
    relevanceScore: latest.relevanceScore ?? 0,
    minScore: input.minScore,
    insufficientEvidence: insufficient,
  });

  const draft = await prisma.emailDraft.create({
    data: {
      professorId: professor.id,
      discoveryRunId: input.runId,
      subject: email.subject,
      body: email.body,
      personalizedTopics: JSON.stringify(email.personalized_topics),
      studentClaims: JSON.stringify(email.student_claims),
      validationErrors: JSON.stringify(failures),
      validationPassed: failures.length === 0,
      status: failures.length ? "VALIDATION_FAILED" : "QUEUED",
      failureReason: failures[0]?.message,
    },
  });
  logger.info(failures.length ? "validation_failed" : "validation_passed", {
    draftId: draft.id,
    professorId: professor.id,
    failures: failures.map((item) => item.code),
  });
  logger.info("draft_generated", { draftId: draft.id, professorId: professor.id });

  if (failures.length === 0) {
    await prisma.professor.update({ where: { id: professor.id }, data: { status: "QUEUED" } });
    const settings = await getAppSettings();
    if (settings.AUTO_SEND && (latest.relevanceScore ?? 0) >= settings.AUTOPILOT_MIN_SCORE) {
      await sleep(jitterDelayMs());
      await sendApprovedDraft(draft.id, { autopilot: true });
    }
    return { researched: true, qualified: true, queued: true };
  }
  return { researched: true, qualified: true, queued: false };
}

export async function sendApprovedDraft(draftId: string, options?: { autopilot?: boolean }) {
  const draft = await prisma.emailDraft.findUnique({
    where: { id: draftId },
    include: { professor: { include: { evidence: true } } },
  });
  if (!draft) throw new Error("Draft not found");
  const settings = await getAppSettings();
  assertDraftSendable({
    status: draft.status,
    autopilot: options?.autopilot,
    autoSend: settings.AUTO_SEND,
  });
  const resumePath = resolveResumePath();
  const resume = await loadStudentProfile(resumePath);
  if (!resume.ok) throw new Error(resume.error);

  if (await dailyCapReached()) {
    throw new Error(`Daily email cap of ${settings.MAX_EMAILS_PER_DAY} has been reached.`);
  }
  if (draft.professor.email && (await isInCooldown(draft.professor.email))) {
    throw new Error("This professor was contacted within the cooldown window.");
  }

  const failures = validateEmailDraft({
    professorName: draft.professor.fullName,
    professorEmail: draft.professor.email,
    subject: draft.subject,
    body: draft.body,
    topics: JSON.parse(draft.professor.researchTopics || "[]") as string[],
    evidenceTexts: draft.professor.evidence.map((item) => item.extractedText),
    evidenceUrls: draft.professor.evidence.map((item) => item.url),
    student: resume.profile,
    resumeAvailable: resumeExists(resumePath),
    relevanceScore: draft.professor.relevanceScore ?? 0,
    minScore: options?.autopilot ? settings.AUTOPILOT_MIN_SCORE : settings.MIN_RELEVANCE_SCORE,
    insufficientEvidence: draft.professor.insufficientEvidence,
  });
  if (failures.length) {
    await prisma.emailDraft.update({
      where: { id: draft.id },
      data: {
        status: "VALIDATION_FAILED",
        validationPassed: false,
        validationErrors: JSON.stringify(failures),
        failureReason: failures.map((item) => item.message).join(" "),
        approvedAt: null,
      },
    });
    throw new Error(failures[0]?.message ?? "Quality gate failed");
  }
  if (!draft.professor.email) throw new Error("Professor email is missing.");

  const existingSend = await prisma.emailSend.findFirst({
    where: { draftId: draft.id, status: { in: ["SENT", "DRY_RUN", "SUBMITTING", "UNKNOWN"] } },
  });
  if (existingSend) {
    throw new Error("This draft already has a send attempt. Open Sent history instead of retrying blindly.");
  }

  let reservation;
  try {
    reservation = await prisma.emailSend.create({
      data: {
        professorId: draft.professorId,
        draftId: draft.id,
        recipient: draft.professor.email,
        recipientNormalized: normalizeEmail(draft.professor.email),
        subject: draft.subject,
        body: draft.body,
        status: "SUBMITTING",
        dryRun: settings.DRY_RUN,
      },
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new Error("This draft already has a send attempt. Open Sent history instead of retrying blindly.");
    }
    throw error;
  }

  const provider = createEmailProvider();
  let result;
  try {
    result = await provider.sendResearchEmail({
      recipient: draft.professor.email,
      subject: draft.subject,
      body: draft.body,
      resumePath,
    });
  } catch (error) {
    await prisma.emailSend.update({
      where: { id: reservation.id },
      data: {
        status: "UNKNOWN",
        failureReason: error instanceof Error ? error.message : "Send interrupted before a Graph response",
      },
    });
    throw error;
  }

  const status = result.ok ? (result.dryRun ? "DRY_RUN" : "SENT") : "FAILED";
  const send = await prisma.emailSend.update({
    where: { id: reservation.id },
    data: {
      status,
      dryRun: result.dryRun,
      graphStatus: result.graphStatus,
      failureReason: result.error,
      sentAt: result.ok ? new Date() : null,
    },
  });
  await prisma.emailDraft.update({
    where: { id: draft.id },
    data: {
      status,
      sentAt: result.ok && !result.dryRun ? new Date() : null,
      failureReason: result.error,
    },
  });
  await prisma.professor.update({
    where: { id: draft.professorId },
    data: {
      status: professorStatusAfterSend(result.dryRun, result.ok),
      lastContactedAt: result.ok && !result.dryRun ? new Date() : undefined,
    },
  });
  if (!result.ok) throw new Error(result.error ?? "Send failed");
  return send;
}
