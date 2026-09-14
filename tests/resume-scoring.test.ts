import { describe, expect, it } from "vitest";
import { parseResumeText } from "@/lib/resume/parser";
import { isResumeSupportedClaim } from "@/lib/resume/claims";
import { professorAnalysisSchema } from "@/lib/validation/schemas";
import { scoreProfessorRelevance } from "@/lib/research/scorer";

const resumeText = `
SAKET
The University of Texas at Dallas
EXPERIENCE
ClinicalHours
Helped with the development of the ClinicalHours website, using AI to help with development.
PROJECTS
Canvas Companion
Helped build syllabus extraction and LLM parsing features using TypeScript.
ChartWise
Helped with a market data pipeline using SQL and PostgreSQL.
Cloud of Goods
Contributed to a web project using React.
TECHNICAL SKILLS
Python Java SQL JavaScript TypeScript HTML/CSS React Next.js Supabase PostgreSQL Git GitHub Railway Cloudflare REST APIs Linux Networking Wireshark
`;

describe("resume and scoring", () => {
  const profile = parseResumeText(resumeText, "data/resume.pdf");

  it("parses projects and skills from resume text", () => {
    expect(profile.projects.map((project) => project.name)).toEqual(
      expect.arrayContaining(["ClinicalHours", "Canvas Companion", "ChartWise", "Cloud of Goods"]),
    );
    expect(profile.technicalSkills).toEqual(expect.arrayContaining(["Python", "TypeScript", "Wireshark"]));
  });

  it("rejects upgrading helped into built for ClinicalHours", () => {
    const result = isResumeSupportedClaim("I independently built ClinicalHours from scratch.", profile);
    expect(result.ok).toBe(false);
  });

  it("allows a helped-with claim", () => {
    expect(isResumeSupportedClaim("I recently helped with the development of the ClinicalHours website.", profile).ok).toBe(true);
  });

  it("validates structured professor analysis with Zod", () => {
    const parsed = professorAnalysisSchema.parse({
      research_topics: ["program analysis"],
      research_summary: "Supported by the page.",
      current_projects: [],
      student_connections: [],
      relevance_score: 70,
      relevance_reason: "software security overlap",
      evidence_claims: [{ claim: "Mentions program analysis", url: "https://example.edu/faculty" }],
      insufficient_evidence: false,
    });
    expect(parsed.research_topics).toEqual(["program analysis"]);
    expect(() => professorAnalysisSchema.parse({ research_topics: "nope" })).toThrow();
  });

  it("does not qualify a CS member with no research overlap", () => {
    const scored = scoreProfessorRelevance({
      pageText: "Professor Smith teaches introductory computer science courses in the department.",
      student: profile,
      hasCurrentActivity: false,
    });
    expect(scored.score).toBeLessThan(65);
  });

  it("scores AI and security research more highly", () => {
    const ai = scoreProfessorRelevance({
      pageText: "Research in large language models, machine learning, and natural language processing. Current publications 2026.",
      student: profile,
      hasCurrentActivity: true,
    });
    const security = scoreProfessorRelevance({
      pageText: "Research in software security, program analysis, and static analysis of software systems.",
      student: profile,
      hasCurrentActivity: true,
    });
    expect(ai.score).toBeGreaterThanOrEqual(65);
    expect(security.score).toBeGreaterThanOrEqual(50);
  });
});
