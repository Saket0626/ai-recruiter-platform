import { isGenericInbox, isValidEmailShape, normalizeEmail } from "@/lib/security/email";
import { isResumeSupportedClaim } from "@/lib/resume/claims";
import { wordCount } from "@/lib/email/generator";
import { draftUsesResearchDetail, extractGroundedResearchDetail } from "@/lib/email/research-detail";
import { topicSupportedByEvidence } from "@/lib/research/keywords";
import { styleFailures } from "@/lib/email/style";
import type { StudentProfile } from "@/lib/validation/schemas";

export type QualityFailure = {
  code: string;
  message: string;
};

const BANNED_PHRASES = [
  "groundbreaking research",
  "truly inspires",
  "i have always dreamed",
  "passionate about leveraging",
  "delve into",
  "i hope this email finds you well",
  "as an ai",
  "cutting-edge",
  "synergy",
];

export function validateEmailDraft(input: {
  professorName: string;
  professorEmail?: string | null;
  subject: string;
  body: string;
  topics: string[];
  evidenceTexts: string[];
  evidenceUrls: string[];
  student: StudentProfile;
  resumeAvailable: boolean;
  relevanceScore: number;
  minScore: number;
  insufficientEvidence: boolean;
}): QualityFailure[] {
  const failures: QualityFailure[] = [];
  const email = input.professorEmail ? normalizeEmail(input.professorEmail) : "";
  const lastName = input.professorName.trim().split(/\s+/).at(-1) ?? "";

  if (!email || !isValidEmailShape(email)) {
    failures.push({ code: "invalid_email", message: "Professor email is missing or invalid." });
  } else if (isGenericInbox(email)) {
    failures.push({ code: "generic_inbox", message: "Address looks like a generic department inbox." });
  }
  if (!input.resumeAvailable) {
    failures.push({ code: "missing_resume", message: "Resume PDF is missing. Sending is disabled." });
  }
  if (input.insufficientEvidence) {
    failures.push({ code: "insufficient_evidence", message: "Professor does not have enough retrieved evidence." });
  }
  if (input.relevanceScore < input.minScore) {
    failures.push({
      code: "low_score",
      message: `Relevance score ${input.relevanceScore} is below the threshold ${input.minScore}.`,
    });
  }
  if (!input.topics.length) {
    failures.push({ code: "no_topics", message: "No evidence-backed research topics were stored." });
  }
  if (!input.body.toLowerCase().includes(lastName.toLowerCase())) {
    failures.push({ code: "name_mismatch", message: "Email body does not mention the professor's name." });
  }
  if (!/attached my resume/i.test(input.body)) {
    failures.push({ code: "missing_resume_sentence", message: "Email does not mention the attached resume." });
  }
  if (/\[insert|tbd|todo|lorem ipsum|professor x\]/i.test(input.body) || /\[insert|tbd|todo\]/i.test(input.subject)) {
    failures.push({ code: "placeholder", message: "Email contains placeholder text." });
  }
  if (/https?:\/\/|www\./i.test(input.body)) {
    failures.push({ code: "urls_in_body", message: "Email contains a URL." });
  }
  failures.push(...styleFailures(`${input.subject}\n${input.body}`));
  const words = wordCount(input.body);
  if (words < 170 || words > 270) {
    failures.push({ code: "length", message: `Email word count ${words} is outside 170-270.` });
  }
  if (/urgent|research opportunity!!!|amazing research|job request/i.test(input.subject)) {
    failures.push({ code: "bad_subject", message: "Subject line uses a banned style." });
  }
  if (BANNED_PHRASES.some((phrase) => input.body.toLowerCase().includes(phrase))) {
    failures.push({ code: "llm_phrase", message: "Email contains a banned generic or LLM-sounding phrase." });
  }
  if (/relevance score/i.test(input.body)) {
    failures.push({ code: "score_leak", message: "Email mentions the relevance score." });
  }

  const evidence = input.evidenceTexts.join("\n").toLowerCase();
  for (const topic of input.topics) {
    if (!topicSupportedByEvidence(topic, evidence)) {
      failures.push({
        code: "unsupported_professor_claim",
        message: `Research topic "${topic}" is not supported by stored evidence.`,
      });
    }
  }

  const paper = input.body.match(/["“]([^"”]{12,})["”]/g) ?? [];
  for (const title of paper) {
    if (!evidence.includes(title.replace(/["“”]/g, "").toLowerCase().slice(0, 20))) {
      failures.push({ code: "invented_paper", message: `Quoted title is not in retrieved evidence: ${title}` });
    }
  }

  const otherProf = input.body.match(/\bDr\.\s+([A-Z][a-z]+)\b/g) ?? [];
  for (const mention of otherProf) {
    if (!mention.toLowerCase().includes(lastName.toLowerCase())) {
      failures.push({ code: "other_professor", message: `Email mentions another professor: ${mention}` });
    }
  }

  for (const claim of input.body.split("\n").map((line) => line.trim()).filter(Boolean)) {
    const result = isResumeSupportedClaim(claim, input.student);
    if (!result.ok && /clinicalhours|canvas companion|chartwise|built|created/.test(claim.toLowerCase())) {
      failures.push({ code: "unsupported_student_claim", message: result.reason ?? "Unsupported student claim." });
    }
  }

  const personalized = input.topics.some((topic) => input.body.toLowerCase().includes(topic.toLowerCase().slice(0, 16)));
  if (!personalized) {
    failures.push({ code: "not_personalized", message: "Email is not personalized to retrieved research topics." });
  }

  const evidenceBlob = input.evidenceTexts.join(" ").replace(/\s+/g, " ").trim();
  if (evidenceBlob.length >= 80 && !input.insufficientEvidence) {
    const detail = extractGroundedResearchDetail({
      topics: input.topics,
      evidenceTexts: input.evidenceTexts,
    });
    if (!detail || !draftUsesResearchDetail(input.body, detail)) {
      failures.push({
        code: "research_detail_missing",
        message: "Email does not include a retrieved detail from this professor's research.",
      });
    }
  }

  return failures;
}
