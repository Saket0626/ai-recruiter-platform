import { readFileSync } from "node:fs";
import path from "node:path";
import { isLlmConfigured } from "@/lib/config/env";
import { DeterministicLlmProvider } from "@/lib/llm/deterministic";
import { parseStructured } from "@/lib/llm/json";
import { OpenAiCompatibleProvider } from "@/lib/llm/openai-compatible";
import { PROMPT_INJECTION_GUARD, wrapUntrustedData } from "@/lib/security/prompt-injection";
import { professorAnalysisSchema, type ProfessorAnalysis, type StudentProfile } from "@/lib/validation/schemas";
import { logger } from "@/lib/logging/logger";

function loadPrompt() {
  return readFileSync(path.join(process.cwd(), "prompts/professor-analysis.md"), "utf8");
}

function sourceSupported(claim: string, sources: Array<{ url: string; text: string }>) {
  const haystack = sources.map((source) => source.text.toLowerCase()).join("\n");
  const tokens = claim
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 4);
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits >= Math.min(3, tokens.length);
}

export async function analyzeProfessorResearch(input: {
  professorName: string;
  sources: Array<{ url: string; title?: string | null; text: string }>;
  student: StudentProfile;
}): Promise<ProfessorAnalysis> {
  const deterministic = new DeterministicLlmProvider();
  const grounded = deterministic.analyze(input);

  if (!isLlmConfigured()) return grounded;

  try {
    const llm = new OpenAiCompatibleProvider();
    const dataBlocks = input.sources
      .map((source) => wrapUntrustedData(`${source.title ?? "source"} ${source.url}`, source.text.slice(0, 12000)))
      .join("\n\n");
    const user = [
      `Professor name: ${input.professorName}`,
      `Student profile JSON: ${JSON.stringify({
        name: input.student.name,
        university: input.student.university,
        degree: input.student.degree,
        minor: input.student.minor,
        projects: input.student.projects,
        experiences: input.student.experiences,
        technicalSkills: input.student.technicalSkills,
      })}`,
      dataBlocks,
    ].join("\n\n");

    const raw = await llm.complete({
      temperature: 0.1,
      json: true,
      messages: [
        { role: "system", content: `${loadPrompt()}\n\n${PROMPT_INJECTION_GUARD}` },
        { role: "user", content: user },
      ],
    });
    let parsed: ProfessorAnalysis;
    try {
      parsed = parseStructured(professorAnalysisSchema, raw);
    } catch {
      const repair = await llm.complete({
        temperature: 0,
        json: true,
        messages: [
          {
            role: "system",
            content: "Repair the previous response so it is valid JSON matching the required schema. Do not add facts.",
          },
          { role: "user", content: raw },
        ],
      });
      parsed = parseStructured(professorAnalysisSchema, repair);
    }

    const allowedUrls = new Set(input.sources.map((source) => source.url));
    parsed.evidence_claims = parsed.evidence_claims.filter(
      (claim) => allowedUrls.has(claim.url) && sourceSupported(claim.claim, input.sources),
    );
    parsed.research_topics = parsed.research_topics.filter((topic) =>
      input.sources.some((source) => source.text.toLowerCase().includes(topic.toLowerCase().slice(0, 24))),
    );
    if (parsed.research_topics.length === 0) parsed.insufficient_evidence = true;
    return professorAnalysisSchema.parse(parsed);
  } catch (error) {
    logger.warn("llm_analysis_fallback", {
      professor: input.professorName,
      error: error instanceof Error ? error.message : "llm failed",
    });
    return grounded;
  }
}
