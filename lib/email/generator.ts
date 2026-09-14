import { DEFAULT_STUDENT } from "@/lib/config/defaults";
import { familyForTopics } from "@/lib/research/scorer";
import type { GeneratedEmail, StudentProfile } from "@/lib/validation/schemas";
import { generatedEmailSchema } from "@/lib/validation/schemas";

function honorific(lastName: string) {
  return `Dr. ${lastName}`;
}

function pickProject(topics: string[], profile: StudentProfile) {
  const joined = topics.join(" ").toLowerCase();
  const named = (name: string) => profile.projects.find((project) => project.name.toLowerCase() === name.toLowerCase());
  if (/language model|nlp|machine learning|artificial intelligence|vision|deep learning/.test(joined)) {
    return named("Canvas Companion") ?? profile.projects[0];
  }
  if (/security|privacy|cyber/.test(joined)) {
    return named("ClinicalHours") ?? profile.projects[0];
  }
  if (/database|data|pipeline|systems/.test(joined)) {
    return named("ChartWise") ?? named("ClinicalHours") ?? profile.projects[0];
  }
  if (/information systems|hci|organization/.test(joined)) {
    return named("ClinicalHours") ?? profile.projects[0];
  }
  if (/software engineering|program analysis/.test(joined)) {
    return named("Canvas Companion") ?? named("ChartWise") ?? profile.projects[0];
  }
  return named("Cloud of Goods") ?? profile.projects[0];
}

function experienceParagraph(topics: string[], profile: StudentProfile) {
  const project = pickProject(topics, profile);
  const summary = project?.summary || "I have been working on undergraduate software projects in TypeScript and Python.";
  const joined = topics.join(" ").toLowerCase();
  if (/language model|nlp|artificial intelligence|machine learning/.test(joined) && project?.name === "Canvas Companion") {
    return `I recently helped with Canvas Companion, a project that extracts syllabus information and uses LLM parsing to organize course content. Working on that made me curious about how language models can support real student workflows.`;
  }
  if (/security|privacy|cyber/.test(joined)) {
    return `I recently helped with the development of the ClinicalHours website, using AI to help with development, and I have been studying cybersecurity, Linux, and networking fundamentals. That combination made me more interested in how software systems protect information.`;
  }
  if (/information systems/.test(joined)) {
    return `I recently helped with the development of the ClinicalHours website, using AI to help with development, and became fascinated by how technology affects the way people and organizations use and share information.`;
  }
  if (/database|data science|pipeline/.test(joined) && project?.name === "ChartWise") {
    return `I recently helped with ChartWise, including work around market data pipelines and web interfaces. Seeing how data moves through a system made me want to learn more about data-intensive research software.`;
  }
  if (/software engineering|program analysis/.test(joined)) {
    return `I recently helped with Canvas Companion and ClinicalHours, writing TypeScript and working with web systems. Those projects made me interested in how software is built, analyzed, and made more reliable.`;
  }
  return `I recently ${summary.charAt(0).toLowerCase()}${summary.slice(1)} That work made me want to learn how similar ideas show up in research labs.`;
}

function connectionParagraph(topics: string[], profile: StudentProfile) {
  const focus = topics.slice(0, 2).join(" and ") || "software research";
  if (/security|privacy/.test(topics.join(" ").toLowerCase())) {
    return `Seeing how software is used in real settings made me curious about ${focus}. I am eager to gain experience in your lab, applying my background in ${profile.technicalSkills.slice(0, 3).join(", ") || "software development"} while learning more about ${focus}.`;
  }
  if (/information systems/.test(topics.join(" ").toLowerCase())) {
    return `Seeing how technology is used within organizations made me curious about how information systems influence security, privacy, and business decisions. I am eager to gain experience in your lab, applying my background in technology to help investigate information systems while learning more about ${focus}.`;
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
  const schoolShort = "UT Dallas";
  const body = [
    `Hello ${honorific(input.professorLastName)},`,
    ``,
    `My name is ${DEFAULT_STUDENT.name}, and I am a ${DEFAULT_STUDENT.currentStatus.toLowerCase()} at ${schoolShort} interested in pursuing ${DEFAULT_STUDENT.degree.replace("B.S. ", "")}. I am interested in your research on ${topicPhrase}. I would love to learn more about your lab's work on ${topics[0] || "this research"} and see if I am able to assist with your research!`,
    ``,
    experienceParagraph(topics, input.student),
    ``,
    `${connectionParagraph(topics, input.student)} I have attached my resume for your review. I am available to start immediately and continue through the spring and beyond. Thank you for your time and consideration!`,
    ``,
    `Sincerely,`,
    DEFAULT_STUDENT.name,
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
    .filter((line) => /clinicalhours|canvas companion|chartwise|cloud of goods|helped|python|typescript/i.test(line));
}

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
