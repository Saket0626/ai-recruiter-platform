import { familyForTopics } from "@/lib/research/scorer";
import { interpretProfessorResearch } from "@/lib/research/interpret";
import { matchResumeToResearch, type ResumeMatch } from "@/lib/email/resume-match";
import { sanitizeGeneratedText } from "@/lib/email/style";
import { DEFAULT_AVAILABILITY_SENTENCE } from "@/lib/config/defaults";
import type { GeneratedEmail, StudentProfile } from "@/lib/validation/schemas";
import { generatedEmailSchema } from "@/lib/validation/schemas";

type StudentWork = {
  id: string;
  name: string;
  kind: "experience" | "project";
  role: string;
  summary: string;
};

function honorificLastName(lastName: string, fullName?: string) {
  const source = `${fullName || ""} ${lastName}`.trim();
  const parts = source
    .replace(/[^A-Za-z.'\- ]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 1 && !/^(b|jr|sr|ii|iii|iv)\.?$/i.test(part));
  return parts.at(-1) || lastName.split(/\s+/).at(-1) || lastName;
}

function honorific(lastName: string, fullName?: string) {
  return `Dr. ${honorificLastName(lastName, fullName)}`;
}

function allWork(profile: StudentProfile): StudentWork[] {
  return [
    ...profile.experiences.map((item) => ({
      id: item.id,
      name: item.organization,
      kind: "experience" as const,
      role: item.role ?? "",
      summary: item.summary,
    })),
    ...profile.projects.map((item) => ({
      id: item.id,
      name: item.name,
      kind: "project" as const,
      role: "",
      summary: item.summary,
    })),
  ];
}

function degreeFocus(profile: StudentProfile) {
  return profile.degree.replace(/^B\.S\.\s+/i, "") || "Computer Information Systems and Technology";
}

function uncapitalize(text: string) {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function experienceParagraph(match: ResumeMatch) {
  const fact = uncapitalize(match.verifiedFact.replace(/[.]+$/, ""));
  if (match.experienceName.toLowerCase() === "clinicalhours") {
    return `I recently helped a small startup, ClinicalHours, with software development. I ${fact}.`.replace(/\s+/g, " ").trim();
  }
  return `I recently ${fact}.`.replace(/\s+/g, " ").trim();
}

function connectionParagraph(match: ResumeMatch, specific: string, broad: string) {
  if (match.honestCuriosity) {
    return `${match.conceptualBridge} I am eager to gain research experience in your lab while learning more about ${broad}.`;
  }
  return `${match.conceptualBridge} Your work on ${specific} especially interested me because it is a concrete research problem in ${broad}. I am eager to gain research experience in your lab while learning more about ${broad}.`;
}

export function generateGroundedEmail(input: {
  professorLastName: string;
  professorFullName: string;
  topics: string[];
  researchSummary: string;
  student: StudentProfile;
  evidenceTexts?: string[];
  availabilitySentence?: string;
}): GeneratedEmail {
  const topics = input.topics.slice(0, 3);
  const research = interpretProfessorResearch({
    topics,
    evidenceTexts: input.evidenceTexts?.length ? input.evidenceTexts : undefined,
    researchSummary: input.researchSummary,
  });
  const specific = research.specificProblem || topics[0] || "this research";
  const broad = research.broadArea || topics[0] || "this research";
  const match = matchResumeToResearch({ student: input.student, research, topics });
  const studentName = input.student.name.split(" ")[0] || "Saket";
  const availability = (input.availabilitySentence ?? DEFAULT_AVAILABILITY_SENTENCE).replace(/[.]+$/, "");
  const body = sanitizeGeneratedText(
    [
      `Dear ${honorific(input.professorLastName, input.professorFullName)},`,
      ``,
      `My name is ${studentName}, and I am a ${input.student.currentStatus.toLowerCase()} at UT Dallas interested in pursuing ${degreeFocus(input.student)}. I am very interested in your research on ${broad}, particularly ${specific}. I would love to learn more about your lab's work and see if I could assist with your research.`,
      ``,
      experienceParagraph(match),
      ``,
      `${connectionParagraph(match, specific, broad)} I have attached my resume for your review. ${availability}. I can contribute a few hours each week and I am hoping to learn how your group approaches this work in practice. Thank you for your time and consideration.`,
      ``,
      `Sincerely,`,
      studentName,
    ].join("\n"),
  );

  const family = familyForTopics(topics);
  const subject =
    /database|distributed|data management/.test(`${broad} ${specific}`)
      ? "UT Dallas Student Interested in Your Data Systems Research"
      : family === "ai"
        ? "Undergraduate Research Interest in AI Systems"
        : /security/.test(broad)
          ? "Undergraduate Research Interest in Software Security"
          : /information systems/.test(broad)
            ? "Interest in Undergraduate Research in Information Systems"
            : /program analysis/.test(broad)
              ? "Research Interest in Program Analysis"
              : `UT Dallas Student Interested in Your ${broad || "Research"} Research`;

  return generatedEmailSchema.parse({
    subject: sanitizeGeneratedText(subject),
    body,
    personalized_topics: topics,
    student_claims: extractClaims(body, input.student),
  });
}

function extractClaims(body: string, profile: StudentProfile) {
  const lower = body.toLowerCase();
  return allWork(profile)
    .filter((work) => work.name.length > 2 && lower.includes(work.name.toLowerCase()))
    .map((work) => work.id);
}

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
