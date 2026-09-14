import { familyForTopics } from "@/lib/research/scorer";
import type { GeneratedEmail, StudentProfile } from "@/lib/validation/schemas";
import { generatedEmailSchema } from "@/lib/validation/schemas";

type StudentWork = {
  name: string;
  kind: "experience" | "project";
  role: string;
  summary: string;
};

function honorific(lastName: string) {
  return `Dr. ${lastName}`;
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

function experienceParagraph(topics: string[], profile: StudentProfile) {
  const work = pickWork(topics, profile);
  if (!work?.summary) {
    return `I have been working on undergraduate software projects using ${profile.technicalSkills.slice(0, 3).join(", ") || "TypeScript and Python"}.`;
  }
  const claim = firstSentence(work.summary);
  const where = work.kind === "experience" ? `At ${work.name}${work.role ? ` as a ${work.role}` : ""}` : `On ${work.name}`;
  return `${where}, ${claim.charAt(0).toLowerCase()}${claim.slice(1)}${claim.endsWith(".") ? "" : "."}`;
}

function connectionParagraph(topics: string[], profile: StudentProfile) {
  const focus = topics.slice(0, 2).join(" and ") || "software research";
  const skills = profile.technicalSkills.slice(0, 3).join(", ") || "software development";
  if (/security|privacy/.test(topics.join(" ").toLowerCase())) {
    return `That work, along with studying cybersecurity, Linux, and networking fundamentals, made me more interested in ${focus}. I am eager to gain experience in your lab, applying my background in ${skills} while learning more about ${focus}.`;
  }
  if (/information systems/.test(topics.join(" ").toLowerCase())) {
    return `Seeing how technology is used within organizations made me curious about how information systems influence security, privacy, and business decisions. I am eager to gain experience in your lab while learning more about ${focus}.`;
  }
  if (/artificial intelligence|machine learning|language model/.test(topics.join(" ").toLowerCase())) {
    return `I am still early in my studies, but I want to learn how ${focus} research is actually done. I hope to contribute in small, practical ways while building a stronger foundation in the area.`;
  }
  return `I am eager to gain experience in your lab, connecting my undergraduate software work to ${focus} while learning from the research process.`;
}

export function generateGroundedEmail(input: {
  professorLastName: string;
  professorFullName: string;
  topics: string[];
  researchSummary: string;
  student: StudentProfile;
}): GeneratedEmail {
  const topics = input.topics.slice(0, 3);
  const topicPhrase = topics.length > 1 ? `${topics[0]}, ${topics.slice(1).join(", ")}` : topics[0] || "software research";
  const studentName = input.student.name.split(" ")[0] || "Saket";
  const body = [
    `Hello ${honorific(input.professorLastName)},`,
    ``,
    `My name is ${studentName}, and I am a ${input.student.currentStatus.toLowerCase()} at UT Dallas interested in pursuing ${input.student.degree.replace("B.S. ", "")}. I am interested in your research on ${topicPhrase}. I would love to learn more about your lab's work on ${topics[0] || "this research"} and see if I am able to assist with your research!`,
    ``,
    experienceParagraph(topics, input.student),
    ``,
    `${connectionParagraph(topics, input.student)} I have attached my resume for your review. I am available to start immediately and continue through the spring and beyond. Thank you for your time and consideration!`,
    ``,
    `Sincerely,`,
    studentName,
  ].join("\n");

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
    subject,
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
