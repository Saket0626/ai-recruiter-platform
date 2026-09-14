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
    expect(profile.experiences.map((item) => item.organization)).toEqual(expect.arrayContaining(["ClinicalHours"]));
    expect(profile.projects.map((project) => project.name)).toEqual(
      expect.arrayContaining(["Canvas Companion", "ChartWise", "Cloud of Goods"]),
    );
    expect(profile.projects.map((project) => project.name)).not.toContain("ClinicalHours");
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

  it("parses internships and project bullets from the official resume layout", () => {
    const official = parseResumeText(
      `SAKET AMANANA
Education
The University of Texas at Dallas Richardson, TX
B.S. Computer Information Systems and Technology, Minor in Cybersecurity Expected May 2029
Relevant Experience
ClinicalHours May 2026 – Present
Software Engineer Intern Dallas, TX
• Built React/TypeScript interfaces for students to search clinical opportunities, view facility details, and submit appli-
cations across desktop and mobile.
Cloud of Goods June 2025 – August 2025
GTM Engineer Intern Orlando, FL
• Analyzed customer and product data across transportation and stroller-rental categories.
Projects
Canvas Companion | TypeScript, Chrome Extension
• Launched a public Chrome extension consolidating Canvas deadlines and syllabus data into one side-panel calendar.
ChartWise | React, TypeScript, Postgres
• Built a React, TypeScript, and Postgres platform on Railway/Supabase to manage trading lessons.
Technical Skills
Languages Python, Java, SQL, JavaScript/TypeScript, HTML/CSS
`,
      "data/resume.pdf",
    );
    expect(official.name).toMatch(/Saket/i);
    expect(official.minor).toMatch(/Cybersecurity/i);
    expect(official.experiences.map((item) => item.organization)).toEqual(["ClinicalHours", "Cloud of Goods"]);
    expect(official.experiences[0]?.role).toMatch(/Software Engineer Intern/i);
    expect(official.experiences[0]?.summary).toMatch(/Built React\/TypeScript interfaces/i);
    expect(official.experiences[0]?.summary).toMatch(/applications across desktop and mobile/i);
    expect(official.projects.map((item) => item.name)).toEqual(["Canvas Companion", "ChartWise"]);
    expect(official.projects.map((item) => item.name)).not.toContain("ClinicalHours");
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
