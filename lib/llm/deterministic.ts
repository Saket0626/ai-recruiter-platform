import { professorAnalysisSchema, type ProfessorAnalysis, type StudentProfile } from "@/lib/validation/schemas";
import { findKeywordMatches, uniqueLabels } from "@/lib/research/keywords";
import { scoreProfessorRelevance } from "@/lib/research/scorer";
import type { LLMProvider } from "@/lib/llm/provider";

export class DeterministicLlmProvider implements LLMProvider {
  readonly name = "deterministic";

  async complete(): Promise<string> {
    throw new Error("Deterministic provider does not implement free-form completion");
  }

  analyze(input: {
    professorName: string;
    sources: Array<{ url: string; title?: string | null; text: string }>;
    student: StudentProfile;
  }): ProfessorAnalysis {
    const combined = input.sources.map((source) => source.text).join("\n");
    const matches = findKeywordMatches(combined);
    const topics = uniqueLabels(matches);
    const scored = scoreProfessorRelevance({
      pageText: combined,
      student: input.student,
      hasCurrentActivity: /publication|conference|current project|ongoing|202[3-9]|2026/i.test(combined),
    });
    const insufficient = topics.length === 0 || combined.replace(/\s+/g, " ").trim().length < 200;
    const evidence = input.sources.flatMap((source) =>
      topics.slice(0, 4).map((topic) => ({
        claim: `${input.professorName} research materials mention ${topic}.`,
        url: source.url,
      })),
    );
    return professorAnalysisSchema.parse({
      research_topics: topics,
      research_summary: insufficient
        ? "Insufficient public research evidence was retrieved from the supplied pages."
        : scored.explanation,
      current_projects: /project/i.test(combined) ? ["Active research mentioned on retrieved pages"] : [],
      student_connections: topics.slice(0, 3).map((topic) => ({
        resumeItem: input.student.projects[0]?.name || input.student.technicalSkills[0] || "coursework",
        professorTopic: topic,
        explanation: scored.explanation,
      })),
      relevance_score: insufficient ? 0 : scored.score,
      relevance_reason: scored.explanation,
      evidence_claims: evidence.slice(0, 8),
      insufficient_evidence: insufficient,
    });
  }
}
