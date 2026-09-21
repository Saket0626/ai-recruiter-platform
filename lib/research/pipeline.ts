import { prisma } from "@/lib/db/prisma";
import { upsertProfessor } from "@/lib/db/professors";
import { getAppSettings } from "@/lib/db/settings";
import { DEFAULT_RESEARCH_KEYWORDS } from "@/lib/config/defaults";
import { logger } from "@/lib/logging/logger";
import { analyzeProfessorResearch } from "@/lib/research/analyzer";
import { FallbackResearchProvider } from "@/lib/research/crawler";
import { extractProfileDetails, looksLikePersonName, sourcePriority } from "@/lib/research/parser";
import { topicSupportedByEvidence, saketTopicLabels, isSaketRelevantResearch } from "@/lib/research/keywords";
import { hasPublishedResearch, publicationLinks } from "@/lib/research/publications";
import { scoreProfessorRelevance } from "@/lib/research/scorer";
import { CompositeSearchProvider } from "@/lib/search/composite";
import { generateGroundedEmail } from "@/lib/email/generator";
import { interpretProfessorResearch } from "@/lib/research/interpret";
import { containsPageGarbage } from "@/lib/research/page-classify";
import { dailyCapReached, isInCooldown, jitterDelayMs, sentCountToday } from "@/lib/email/rate-limit";
import { assertDraftSendable, professorStatusAfterSend } from "@/lib/email/send-gate";
import { hashResumePdf } from "@/lib/resume/hash";
import { loadStudentProfile, resolveResumePath, resumeExists } from "@/lib/resume/service";
import { isGenericInbox, normalizeEmail, normalizeUrl } from "@/lib/security/email";
import { resolveUniversitySelections, type ResolvedUniversity } from "@/lib/universities/catalog";
import { discoveryInputSchema, type DiscoveryInput, type StudentProfile } from "@/lib/validation/schemas";
import { validateEmailDraft } from "@/lib/validation/email-quality";
import { MAX_PACKAGES_PER_RUN, MAX_PROFESSORS_PER_COLLEGE } from "@/lib/bot/config";
import { outreachPackageFromDraft } from "@/lib/bot/packages";
import { appendPackageToCursorDoc } from "@/lib/bot/cursor-doc";

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
  return Math.min(input.maxCandidatesPerUniversity, fairShare);
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
    maxCandidatesPerUniversity: MAX_PROFESSORS_PER_COLLEGE,
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
      progress.currentUniversity = university.name;
      await updateRun(run.id, {
        currentStage: `DISCOVER:${university.shortName}`,
        progressJson: JSON.stringify(progress),
      });
      if (progress.queued >= MAX_PACKAGES_PER_RUN) break;
      await discoverOneUniversity({
        university,
        keywords,
        student,
        minScore: input.minScore,
        runId: run.id,
        research,
        remaining: capPerSchool,
        progress,
        countOnlyEmailed: universities.length === 1,
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
  countOnlyEmailed?: boolean;
}) {
  if (input.remaining <= 0) return;
  const search = new CompositeSearchProvider(input.university.seedUrls);
  const scanBudget = input.countOnlyEmailed
    ? Math.max(input.remaining * 8, 80)
    : Math.max(input.remaining * 8, 12);
  const hits = await search.searchFaculty({
    university: input.university.name,
    domain: input.university.domain,
    keywords: input.keywords,
    maxResults: scanBudget,
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

  for (const hit of hits) {
    const person =
      nameFromHit(hit.title, hit.url, input.university.domain, hit.snippet) ??
      (looksLikePersonName(hit.title)
        ? {
            firstName: hit.title.split(/\s+/)[0] ?? hit.title,
            lastName: hit.title.split(/\s+/).filter(Boolean).at(-1) || hit.title,
            fullName: hit.title,
            title: null,
            email: null,
            emailSourceUrl: null,
            facultyPageUrl: hit.url,
            labUrl: null,
            personalWebsite: null,
            snippet: hit.snippet,
          }
        : null);
    if (!person || !looksLikePersonName(person.fullName)) continue;
    if (person.email && isGenericInbox(person.email)) continue;
    const key = (person.email || person.facultyPageUrl || person.fullName).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    peopleQueue.push({ ...person, snippet: person.snippet || hit.snippet });
  }

  peopleQueue.sort((a, b) => Number(isSaketRelevantResearch(b.snippet)) - Number(isSaketRelevantResearch(a.snippet)));

  let scanned = 0;
  let aiQueued = 0;
  for (const person of peopleQueue) {
    if (aiQueued >= input.remaining) break;
    if (scanned >= scanBudget) break;
    scanned += 1;
    try {
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
      if (input.countOnlyEmailed ? result.emailed : result.queued) {
        aiQueued += 1;
      }
      await updateRun(input.runId, {
        currentStage: result.queued ? `EMAIL:${person.lastName}` : `DISCOVER:${input.university.shortName}`,
        progressJson: JSON.stringify(input.progress),
      });
    } catch (error) {
      logger.error("professor_pipeline_failed", {
        name: person.fullName,
        university: input.university.name,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

function nameFromHit(title: string, url: string, domain: string, text: string) {
  const cleaned = title.replace(/[-|].*$/, "").trim();
  if (!looksLikePersonName(cleaned)) return null;
  const names = {
    firstName: cleaned.split(/\s+/)[0] ?? cleaned,
    lastName: cleaned.split(/\s+/).filter(Boolean).at(-1) || cleaned,
    fullName: cleaned,
  };
  const emailMatch = text.match(new RegExp(`[A-Z0-9._%+-]+@[\\w.-]*${domain.replace(".", "\\.")}`, "i"));
  const email = emailMatch?.[0] ? emailMatch[0].toLowerCase() : null;
  if (email && isGenericInbox(email)) return null;
  return {
    ...names,
    title: null,
    email,
    emailSourceUrl: email ? url : null,
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
  if (!looksLikePersonName(input.person.fullName)) {
    return { researched: false, qualified: false, queued: false };
  }
  if (input.person.email && isGenericInbox(input.person.email)) {
    return { researched: false, qualified: false, queued: false };
  }
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

  const extraUrls: string[] = [];
  for (const page of pages) {
    const details = extractProfileDetails(page.html, page.url, input.domain);
    extraUrls.push(...publicationLinks(details.links, page.url));
  }
  const seenUrls = new Set(pages.map((page) => page.url));
  const follow = extraUrls.filter((url) => !seenUrls.has(url)).slice(0, 2);
  if (follow.length) {
    try {
      const extraPages = await input.research.retrieve(follow);
      pages.push(...extraPages);
    } catch (error) {
      logger.warn("publication_follow_failed", {
        professorId: professor.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const evidenceRows: Array<{
    professorId: string;
    url: string;
    title: string | null;
    extractedText: string;
    claim: string;
    sourcePriority: number;
  }> = [];
  let combinedText = input.person.snippet;
  for (const page of pages) {
    const details = extractProfileDetails(page.html, page.url, input.domain);
    combinedText += `\n${details.text}`;
    if (!professor.email && details.email && !isGenericInbox(details.email)) {
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
      claim: hasPublishedResearch(details.text) ? "Retrieved public research or publication page" : "Retrieved public academic page",
      sourcePriority: sourcePriority(page.url, input.domain),
    });
  }
  if (evidenceRows.length) {
    await prisma.researchEvidence.createMany({ data: evidenceRows });
  }

  const analysis = await analyzeProfessorResearch({
    professorName: professor.fullName,
    sources: pages.map((page, index) => ({
      url: page.url,
      title: page.title,
      text: evidenceRows[index]?.extractedText || page.text,
    })),
    student: input.student,
  });
  const evidenceText = evidenceRows.map((row) => row.extractedText).join("\n");
  const relevant = isSaketRelevantResearch(`${combinedText}\n${evidenceText}`);
  const published = hasPublishedResearch(`${combinedText}\n${evidenceText}`, [
    ...evidenceRows.map((row) => row.url),
    ...pages.map((page) => page.url),
  ]);
  const relevantTopics = saketTopicLabels(`${combinedText}\n${evidenceText}`);
  const topics = [
    ...analysis.research_topics.filter((topic) => topicSupportedByEvidence(topic, evidenceText)),
    ...relevantTopics,
  ].filter((topic, index, all) => all.indexOf(topic) === index);
  const scored = scoreProfessorRelevance({
    pageText: combinedText,
    student: input.student,
    hasCurrentActivity: analysis.current_projects.length > 0 || /202[3-9]|2026/.test(combinedText),
  });
  const latestEmail = (await prisma.professor.findUnique({ where: { id: professor.id }, select: { email: true } }))?.email;
  const genericInbox = latestEmail ? isGenericInbox(latestEmail) : false;
  const verifiedResearch = interpretProfessorResearch({
    topics,
    evidenceTexts: evidenceRows.map((row) => row.extractedText),
    researchSummary: analysis.research_summary,
  });
  const insufficient =
    !relevant ||
    !published ||
    !latestEmail ||
    genericInbox ||
    evidenceRows.length === 0 ||
    topics.length === 0 ||
    !verifiedResearch.generationAllowed;
  const status = insufficient ? "INSUFFICIENT_EVIDENCE" : "QUALIFIED";

  await prisma.professor.update({
    where: { id: professor.id },
    data: {
      researchTopics: JSON.stringify(topics),
      researchSummary: analysis.research_summary,
      currentProjects: JSON.stringify(analysis.current_projects),
      relevanceScore: scored.score,
      relevanceExplanation: analysis.relevance_reason || scored.explanation,
      scoringFactors: JSON.stringify(scored.factors),
      insufficientEvidence: insufficient,
      genericInbox,
      status,
    },
  });
  logger.info("research_completed", {
    professorId: professor.id,
    status,
    score: scored.score,
    relevant,
    published,
  });

  if (insufficient) {
    logger.info("qualification_result", { professorId: professor.id, qualified: false, reason: status });
    return { researched: true, qualified: false, queued: false };
  }

  const existingDraft = await prisma.emailDraft.findFirst({
    where: { professorId: professor.id, status: { in: ["QUEUED", "APPROVED"] } },
  });
  if (existingDraft && !containsPageGarbage(existingDraft.body)) {
    logger.info("draft_generated", { draftId: existingDraft.id, professorId: professor.id, reused: true });
    await prisma.professor.update({ where: { id: professor.id }, data: { status: "QUEUED" } });
    return { researched: true, qualified: true, queued: true, emailed: false };
  }
  if (existingDraft) {
    await prisma.emailDraft.update({
      where: { id: existingDraft.id },
      data: {
        status: "VALIDATION_FAILED",
        failureReason: "Draft used webpage chrome instead of verified research.",
        validationPassed: false,
      },
    });
  }

  logger.info("qualification_result", { professorId: professor.id, qualified: true });
  try {
    const settings = await getAppSettings();
    const email = generateGroundedEmail({
      professorLastName: professor.lastName,
      professorFullName: professor.fullName,
      topics: topics.length ? topics : relevantTopics,
      researchSummary: analysis.research_summary,
      student: input.student,
      evidenceTexts: evidenceRows.map((row) => row.extractedText),
      availabilitySentence: settings.AVAILABILITY_SENTENCE,
    });
    const latest = await prisma.professor.findUniqueOrThrow({ where: { id: professor.id } });
    const alreadyContacted = latest.email ? await isInCooldown(latest.email) : false;
    const failures = validateEmailDraft({
      professorName: latest.fullName,
      professorEmail: latest.email,
      subject: email.subject,
      body: email.body,
      topics: topics.length ? topics : relevantTopics,
      evidenceTexts: evidenceRows.map((row) => row.extractedText),
      evidenceUrls: evidenceRows.map((row) => row.url),
      student: input.student,
      resumeAvailable: resumeExists(),
      relevanceScore: latest.relevanceScore ?? 0,
      minScore: 0,
      insufficientEvidence: false,
      alreadyContacted,
      allowGenericInbox: latest.allowGenericInbox,
      availabilitySentence: settings.AVAILABILITY_SENTENCE,
      forQueue: true,
    });

    const blockingCodes = new Set([
      "invalid_email",
      "generic_inbox",
      "missing_resume",
      "unsupported_student_claim",
      "placeholder",
      "duplicate_recipient",
      "page_garbage",
      "research_not_verified",
      "research_detail_missing",
      "clinicalhours_ownership",
      "fake_connection",
      "unsupported_professor_claim",
    ]);
    const blocking = failures.filter((item) => blockingCodes.has(item.code));
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
        status: blocking.length ? "VALIDATION_FAILED" : "QUEUED",
        failureReason: blocking[0]?.message ?? failures[0]?.message,
      },
    });
    logger.info(blocking.length ? "validation_failed" : "validation_passed", {
      draftId: draft.id,
      professorId: professor.id,
      failures: failures.map((item) => item.code),
    });
    logger.info("draft_generated", {
      draftId: draft.id,
      professorId: professor.id,
      name: latest.fullName,
      email: latest.email,
      university: latest.university,
      research: evidenceRows[0]?.url ?? latest.facultyPageUrl,
    });
    console.log(
      `DRAFT READY | ${latest.fullName} | ${latest.email} | ${latest.university} | ${evidenceRows[0]?.url ?? latest.facultyPageUrl ?? ""}`,
    );

    if (blocking.length === 0) {
      let emailed = false;
      await prisma.professor.update({ where: { id: professor.id }, data: { status: "QUEUED" } });
      try {
        const pkg = outreachPackageFromDraft({
          professorName: latest.fullName,
          college: latest.university,
          professorEmail: latest.email,
          evidenceUrls: evidenceRows.map((row) => row.url),
          facultyPageUrl: latest.facultyPageUrl,
          subject: email.subject,
          body: email.body,
          resumePath: resolveResumePath(),
        });
        if (pkg) await appendPackageToCursorDoc(pkg);
      } catch (error) {
        logger.warn("cursor_doc_append_failed", {
          professorId: professor.id,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
      if (failures.length === 0 && settings.AUTO_SEND && (latest.relevanceScore ?? 0) >= settings.AUTOPILOT_MIN_SCORE) {
        await sleep(jitterDelayMs());
        await sendApprovedDraft(draft.id, { autopilot: true });
      }
      return { researched: true, qualified: true, queued: true, emailed };
    }
    return { researched: true, qualified: true, queued: false };
  } catch (error) {
    logger.error("draft_generation_failed", {
      professorId: professor.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { researched: true, qualified: true, queued: false };
  }
}

export async function sendApprovedDraft(draftId: string, options?: { autopilot?: boolean }) {
  const draft = await prisma.emailDraft.findUnique({
    where: { id: draftId },
    include: { professor: { include: { evidence: true } } },
  });
  if (!draft) throw new Error("Draft not found");
  const settings = await getAppSettings();
  const resumePath = resolveResumePath();
  const resume = await loadStudentProfile(resumePath);
  if (!resume.ok) throw new Error(resume.error);
  const currentResumeSha256 = await hashResumePdf(resumePath);
  assertDraftSendable({
    status: draft.status,
    autopilot: options?.autopilot,
    autoSend: settings.AUTO_SEND,
    resumeSha256: draft.resumeSha256,
    currentResumeSha256,
    contentSha256: draft.contentSha256,
    subject: draft.subject,
    body: draft.body,
  });

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
    alreadyContacted: Boolean(draft.professor.email && (await isInCooldown(draft.professor.email))),
    allowGenericInbox: draft.professor.allowGenericInbox,
    autopilot: options?.autopilot,
    availabilitySentence: settings.AVAILABILITY_SENTENCE,
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
        resumeSha256: null,
        contentSha256: null,
      },
    });
    throw new Error(failures[0]?.message ?? "Quality gate failed");
  }
  if (!draft.professor.email) throw new Error("Professor email is missing.");

  let reservation;
  try {
    reservation = await prisma.$transaction(async (tx) => {
      if (!settings.DRY_RUN) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('researchreach-daily-send'))`;
        const sentToday = await sentCountToday(tx);
        if (sentToday >= settings.MAX_EMAILS_PER_DAY) {
          throw new Error(`Daily email cap of ${settings.MAX_EMAILS_PER_DAY} has been reached.`);
        }
      }
      await tx.$queryRaw`SELECT id FROM "Professor" WHERE id = ${draft.professorId} FOR UPDATE`;
      if (draft.professor.email && (await isInCooldown(draft.professor.email, tx))) {
        throw new Error("This professor was contacted within the cooldown window.");
      }
      const existingSend = await tx.emailSend.findFirst({
        where: { draftId: draft.id, status: { in: ["SENT", "DRY_RUN", "SUBMITTING", "UNKNOWN"] } },
      });
      if (existingSend) {
        throw new Error("This draft already has a send attempt. Open Sent history instead of retrying blindly.");
      }
      return tx.emailSend.create({
        data: {
          professorId: draft.professorId,
          draftId: draft.id,
          recipient: draft.professor.email!,
          recipientNormalized: normalizeEmail(draft.professor.email!),
          subject: draft.subject,
          body: draft.body,
          status: "SUBMITTING",
          dryRun: settings.DRY_RUN,
          attachmentSha256: currentResumeSha256,
        },
      });
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new Error("This draft already has a send attempt. Open Sent history instead of retrying blindly.");
    }
    throw error;
  }

  const { createEmailProvider } = await import("@/lib/email/create-provider");
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
