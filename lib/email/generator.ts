import { familyForTopics } from "@/lib/research/scorer";
import { extractGroundedResearchDetail } from "@/lib/email/research-detail";
import { sanitizeGeneratedText } from "@/lib/email/style";
import type { GeneratedEmail, StudentProfile } from "@/lib/validation/schemas";
import { generatedEmailSchema } from "@/lib/validation/schemas";

type StudentWork = {
  name: string;
  kind: "experience" | "project";
  role: string;
  summary: string;
};

function honorificLastName(lastName: string, fullName?: string) {
  const source = `${lastName} ${fullName ?? ""}`.trim();
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
      name: item.organization,
      kind: "experience" as const,
      role: item.role ?? "",
      summary: item.summary,
    })),
    ...profile.projects.map((item) => ({
      name: item.name,
      kind: "project" as const,
      role: "",
      summary: item.summary,
    })),
  ];
}

function namedWork(profile: StudentProfile, name: string) {
  return allWork(profile).find((item) => item.name.toLowerCase() === name.toLowerCase());
}

function firstSentence(summary: string) {
  const cleaned = summary.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^.+?[.](?=\s|$)/);
  return (match?.[0] || cleaned).slice(0, 280);
}

function pickWork(topics: string[], profile: StudentProfile) {
  const joined = topics.join(" ").toLowerCase();
  if (/language model|nlp|machine learning|artificial intelligence|vision|deep learning/.test(joined)) {
    return namedWork(profile, "Canvas Companion") ?? allWork(profile)[0];
  }
  if (/security|privacy|cyber/.test(joined)) {
    return namedWork(profile, "ClinicalHours") ?? allWork(profile)[0];
  }
  if (/database|data|pipeline|systems/.test(joined)) {
    return namedWork(profile, "ChartWise") ?? namedWork(profile, "ClinicalHours") ?? allWork(profile)[0];
  }
  if (/information systems|hci|organization/.test(joined)) {
    return namedWork(profile, "ClinicalHours") ?? namedWork(profile, "Cloud of Goods") ?? allWork(profile)[0];
  }
  if (/software engineering|program analysis/.test(joined)) {
    return namedWork(profile, "Canvas Companion") ?? namedWork(profile, "ChartWise") ?? allWork(profile)[0];
  }
  return namedWork(profile, "Cloud of Goods") ?? namedWork(profile, "ChartWise") ?? allWork(profile)[0];
}

function formatTopics(topics: string[]) {
  if (topics.length === 0) return "your research area";
  if (topics.length === 1) return topics[0];
  if (topics.length === 2) return `${topics[0]} and ${topics[1]}`;
  return `${topics.slice(0, -1).join(", ")}, and ${topics[topics.length - 1]}`;
}

function degreeFocus(profile: StudentProfile) {
  return profile.degree.replace(/^B\.S\.\s+/i, "") || "Computer Information Systems and Technology";
}

function claimForWork(work: StudentWork | undefined, profile: StudentProfile) {
  const skills = profile.technicalSkills.slice(0, 3).join(", ") || "TypeScript and Python";
  if (!work) return `worked on undergraduate software projects using ${skills}`;

  const haystacks = [
    work.summary,
    ...allWork(profile).map((item) => item.summary),
    ...profile.accomplishments,
    profile.resumeText,
  ].filter(Boolean);

  for (const text of haystacks) {
    const sentences = `${text}.`.split(/(?<=[.!?])\s+/);
    const hit = sentences.find((sentence) => {
      const lower = sentence.toLowerCase();
      return lower.includes(work.name.toLowerCase()) && sentence.replace(/\s+/g, " ").trim().length > work.name.length + 24;
    });
    if (hit) {
      return firstSentence(hit)
        .replace(new RegExp(`^${work.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i"), "")
        .replace(/^I\s+/i, "")
        .replace(/[.]+$/, "");
    }
  }

  const summary = firstSentence(work.summary).replace(/^I\s+/i, "").replace(/[.]+$/, "");
  if (summary.toLowerCase() === work.name.toLowerCase()) {
    return `worked on ${work.name} using ${skills}`;
  }
  return summary;
}

function experienceParagraph(topics: string[], profile: StudentProfile) {
  const work = pickWork(topics, profile);
  const core = claimForWork(work, profile);
  const started = core.charAt(0).toLowerCase() + core.slice(1);
  if (work?.name.toLowerCase() === "clinicalhours") {
    return `I recently ${started}, and became fascinated by how technology affects the way people and organizations use and share information.`;
  }
  return `I recently ${started}.`;
}

function connectionParagraph(topics: string[], labWork: string, profile: StudentProfile) {
  const topicPhrase = formatTopics(topics);
  const focus = topics[0] || "this research";
  const joined = topics.join(" ").toLowerCase();
  const work = pickWork(topics, profile);
  if (/information systems/.test(joined)) {
    return `Seeing how technology is used within organizations made me curious about ${labWork}. I am eager to gain experience in your lab, applying my background in technology to help investigate ${focus} while learning more about ${topicPhrase}.`;
  }
  if (/security|privacy/.test(joined)) {
    return `My work on ${work?.name || "undergraduate software projects"} made me curious about ${labWork}. I am eager to gain experience in your lab, applying my background in technology to help investigate ${focus} while learning more about ${topicPhrase}.`;
  }
  if (/artificial intelligence|machine learning|language model/.test(joined)) {
    return `My work on ${work?.name || "undergraduate software projects"} made me curious about ${labWork}. I am eager to gain experience in your lab, applying my background in technology to help investigate ${focus} while learning more about ${topicPhrase}.`;
  }
  return `My work on ${work?.name || "undergraduate software projects"} made me curious about ${labWork}. I am eager to gain experience in your lab, applying my background in technology to help investigate ${focus} while learning more about ${topicPhrase}.`;
}

function labWorkPhrase(input: {
  topics: string[];
  researchSummary: string;
  evidenceTexts?: string[];
}) {
  const evidence =
    input.evidenceTexts && input.evidenceTexts.join("").trim()
      ? input.evidenceTexts
      : [input.researchSummary, ...input.topics].filter(Boolean);
  return extractGroundedResearchDetail({
    topics: input.topics,
    evidenceTexts: evidence,
  }) || input.topics[0] || "this research";
}

export function generateGroundedEmail(input: {
  professorLastName: string;
  professorFullName: string;
  topics: string[];
  researchSummary: string;
  student: StudentProfile;
  evidenceTexts?: string[];
}): GeneratedEmail {
  const topics = input.topics.slice(0, 3);
  const topicPhrase = formatTopics(topics);
  const labWork = labWorkPhrase({
    topics,
    researchSummary: input.researchSummary,
    evidenceTexts: input.evidenceTexts,
  });
  const studentName = input.student.name.split(" ")[0] || "Saket";
  const body = sanitizeGeneratedText(
    [
      `Hello ${honorific(input.professorLastName, input.professorFullName)},`,
      ``,
      `My name is ${studentName}, and I am a ${input.student.currentStatus.toLowerCase()} at UT Dallas interested in pursuing ${degreeFocus(input.student)}. I am interested in your research on ${topicPhrase}. I would love to learn more about your lab's work on ${labWork} and see if I am able to assist with your research this year.`,
      ``,
      experienceParagraph(topics, input.student),
      ``,
      `${connectionParagraph(topics, labWork, input.student)} I have attached my resume for your review. I am available to start immediately and continue through the spring and beyond. I can contribute a few hours each week and I am hoping to learn how your group approaches this work in practice. Thank you for your time and consideration!`,
      ``,
      `Sincerely,`,
      studentName,
    ].join("\n"),
  );

  const family = familyForTopics(topics);
  const subject =
    family === "ai"
      ? "Undergraduate Research Interest in AI Systems"
      : /security/.test(topicPhrase)
        ? "Undergraduate Research Interest in Software Security"
        : /information systems/.test(topicPhrase)
          ? "Interest in Undergraduate Research in Information Systems"
          : /program analysis/.test(topicPhrase)
            ? "Research Interest in Program Analysis"
            : `UT Dallas Student Interested in Your ${topics[0] || "Research"} Research`;

  return generatedEmailSchema.parse({
    subject: sanitizeGeneratedText(subject),
    body,
    personalized_topics: topics,
    student_claims: extractClaims(body),
  });
}

function extractClaims(body: string) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /clinicalhours|canvas companion|chartwise|cloud of goods|helped|built|python|typescript/i.test(line));
}

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
