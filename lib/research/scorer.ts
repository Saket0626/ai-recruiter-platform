import { findKeywordMatches, uniqueLabels, type TopicFamily } from "@/lib/research/keywords";
import type { ScoringFactors, StudentProfile } from "@/lib/validation/schemas";

const AI_CAP = 40;
const SYSTEMS_CAP = 30;
const RESUME_CAP = 20;
const ACTIVITY_CAP = 10;

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function scoreProfessorRelevance(input: {
  pageText: string;
  student: StudentProfile;
  hasCurrentActivity: boolean;
}): { score: number; factors: ScoringFactors; topics: string[]; explanation: string } {
  const matches = findKeywordMatches(input.pageText);
  const aiHits = matches.filter((match) => match.family === "ai");
  const systemHits = matches.filter((match) => match.family === "systems");
  const topics = uniqueLabels(matches);

  const ai = clamp(aiHits.length * 14, AI_CAP);
  const systems = clamp(systemHits.length * 10, SYSTEMS_CAP);

  const resumeHaystack = [
    input.student.resumeText,
    ...input.student.technicalSkills,
    ...input.student.projects.map((project) => `${project.name} ${project.summary}`),
    input.student.minor,
    input.student.degree,
  ]
    .join(" ")
    .toLowerCase();

  let overlapPoints = 0;
  const connections: string[] = [];
  if (aiHits.length && /python|javascript|typescript|llm|ai /i.test(resumeHaystack)) {
    overlapPoints += 8;
    connections.push("student software and scripting background");
  }
  if (aiHits.length >= 2) {
    overlapPoints += 6;
  }
  if (systemHits.some((hit) => hit.id === "sec" || hit.id === "privacy") && /cyber|security|linux|wireshark|network/i.test(resumeHaystack)) {
    overlapPoints += 8;
    connections.push("cybersecurity coursework and networking tools");
  }
  if (systemHits.some((hit) => hit.id === "is" || hit.id === "hci") && /clinicalhours|information|organization/i.test(resumeHaystack)) {
    overlapPoints += 6;
    connections.push("ClinicalHours and information-systems project work");
  }
  if (systemHits.some((hit) => hit.id === "se" || hit.id === "db") && /react|next|sql|postgres|supabase/i.test(resumeHaystack)) {
    overlapPoints += 6;
    connections.push("web systems and database project work");
  }
  if (aiHits.length && /canvas companion|syllabus|llm/i.test(resumeHaystack)) {
    overlapPoints += 5;
    connections.push("Canvas Companion LLM parsing work");
  }
  const resumeOverlap = clamp(overlapPoints, RESUME_CAP);
  const activity = input.hasCurrentActivity ? ACTIVITY_CAP : topics.length ? 4 : 0;
  const total = clamp(ai + systems + resumeOverlap + activity, 100);

  const explanation = topics.length
    ? `Researches ${topics.slice(0, 3).join(", ")}. ${connections.slice(0, 2).join("; ") || "Limited direct resume overlap."}`
    : "No supported research overlap with the configured AI/software keyword families.";

  return {
    score: total,
    factors: { ai, systems, resumeOverlap, activity, total },
    topics,
    explanation,
  };
}

export function familyForTopics(topics: string[]): TopicFamily | "mixed" {
  const joined = topics.join(" ").toLowerCase();
  const ai = /artificial intelligence|machine learning|language model|nlp|vision|deep learning|data science/.test(
    joined,
  );
  const systems = /software|security|privacy|program analysis|distributed|database|network|information systems|hci/.test(
    joined,
  );
  if (ai && systems) return "mixed";
  if (ai) return "ai";
  if (systems) return "systems";
  return "other";
}
