import { z } from "zod";

export const professorStatusSchema = z.enum([
  "DISCOVERED",
  "RESEARCHED",
  "QUALIFIED",
  "INSUFFICIENT_EVIDENCE",
  "QUEUED",
  "APPROVED",
  "REJECTED",
  "SENT",
  "FAILED",
]);

export type ProfessorStatus = z.infer<typeof professorStatusSchema>;

export const draftStatusSchema = z.enum([
  "QUEUED",
  "APPROVED",
  "REJECTED",
  "SENT",
  "FAILED",
  "DRY_RUN",
  "VALIDATION_FAILED",
]);

export const evidenceClaimSchema = z.object({
  claim: z.string().min(1),
  url: z.string().min(1),
});

export const studentConnectionSchema = z.object({
  resumeItem: z.string().min(1),
  professorTopic: z.string().min(1),
  explanation: z.string().min(1),
});

export const professorAnalysisSchema = z.object({
  research_topics: z.array(z.string()),
  research_summary: z.string(),
  current_projects: z.array(z.string()),
  student_connections: z.array(studentConnectionSchema),
  relevance_score: z.number().min(0).max(100),
  relevance_reason: z.string(),
  evidence_claims: z.array(evidenceClaimSchema),
  insufficient_evidence: z.boolean(),
});

export type ProfessorAnalysis = z.infer<typeof professorAnalysisSchema>;

export const generatedEmailSchema = z.object({
  subject: z.string().min(8).max(120),
  body: z.string().min(80),
  personalized_topics: z.array(z.string()).min(1),
  student_claims: z.array(z.string()),
});

export type GeneratedEmail = z.infer<typeof generatedEmailSchema>;

export const studentExperienceSchema = z.object({
  organization: z.string(),
  role: z.string().optional().default(""),
  summary: z.string(),
  verbs: z.array(z.string()).default([]),
});

export const studentProjectSchema = z.object({
  name: z.string(),
  summary: z.string(),
  technologies: z.array(z.string()).default([]),
  verbs: z.array(z.string()).default([]),
});

export const studentProfileSchema = z.object({
  name: z.string(),
  university: z.string(),
  degree: z.string(),
  minor: z.string().optional().default(""),
  graduationDate: z.string(),
  currentStatus: z.string(),
  experiences: z.array(studentExperienceSchema),
  projects: z.array(studentProjectSchema),
  technicalSkills: z.array(z.string()),
  accomplishments: z.array(z.string()),
  resumePath: z.string(),
  resumeText: z.string(),
});

export type StudentProfile = z.infer<typeof studentProfileSchema>;

export const discoveryInputSchema = z.object({
  university: z.string().optional(),
  universities: z.array(z.string()).optional(),
  preset: z.enum(["custom", "top100", "top-cs"]).optional().default("custom"),
  department: z.string().optional().default("Computer Science"),
  universityDomain: z.string().optional(),
  seedUrls: z.array(z.string()).default([]),
  researchInterests: z.array(z.string()).default([]),
  maxCandidates: z.coerce.number().int().min(1).max(300).default(30),
  maxCandidatesPerUniversity: z.coerce.number().int().min(1).max(80).default(12),
  minScore: z.coerce.number().int().min(0).max(100).default(65),
});

export type DiscoveryInput = z.infer<typeof discoveryInputSchema>;

export const scoringFactorsSchema = z.object({
  ai: z.number(),
  systems: z.number(),
  resumeOverlap: z.number(),
  activity: z.number(),
  total: z.number(),
});

export type ScoringFactors = z.infer<typeof scoringFactorsSchema>;
