import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  db: {
    emailDraft: { findUnique: vi.fn(), update: vi.fn() },
    emailSend: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    professor: { update: vi.fn() },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/db/settings", () => ({ getAppSettings: async () => ({
  DRY_RUN: false, AUTO_SEND: false, MAX_EMAILS_PER_DAY: 20,
  MIN_RELEVANCE_SCORE: 65, AUTOPILOT_MIN_SCORE: 80,
}) }));
vi.mock("@/lib/email/create-provider", () => ({ createEmailProvider: () => ({ sendResearchEmail: mocks.send }) }));
vi.mock("@/lib/email/rate-limit", () => ({
  dailyCapReached: async () => false, isInCooldown: async () => false,
  sentCountToday: async () => 0, jitterDelayMs: () => 0,
}));
vi.mock("@/lib/resume/hash", () => ({
  hashResumePdf: async () => "fixture-hash",
  assertResumeHashMatches: (stored: string, current: string) => {
    if (stored !== current) throw new Error("Fixture hash mismatch");
  },
}));
vi.mock("@/lib/resume/service", () => ({
  loadStudentProfile: async () => ({ ok: true, profile: {} }),
  resolveResumePath: () => "data/fixtures/test-only.pdf", resumeExists: () => true,
}));
vi.mock("@/lib/validation/email-quality", () => ({ validateEmailDraft: () => [] }));
// Discovery is outside this test. Keep all its external dependencies inert.
vi.mock("@/lib/db/professors", () => ({ upsertProfessor: vi.fn() }));
vi.mock("@/lib/config/defaults", () => ({ DEFAULT_RESEARCH_KEYWORDS: [] }));
vi.mock("@/lib/logging/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/research/analyzer", () => ({ analyzeProfessorResearch: vi.fn() }));
vi.mock("@/lib/research/crawler", () => ({ FallbackResearchProvider: vi.fn() }));
vi.mock("@/lib/research/parser", () => ({
  extractFacultyFromDirectory: vi.fn(), extractProfileDetails: vi.fn(),
  looksLikePersonName: vi.fn(), sourcePriority: vi.fn(),
}));
vi.mock("@/lib/research/keywords", () => ({ topicSupportedByEvidence: vi.fn() }));
vi.mock("@/lib/research/scorer", () => ({ scoreProfessorRelevance: vi.fn() }));
vi.mock("@/lib/search/composite", () => ({ CompositeSearchProvider: vi.fn() }));
vi.mock("@/lib/email/generator", () => ({ generateGroundedEmail: vi.fn() }));
vi.mock("@/lib/universities/catalog", () => ({ resolveUniversitySelections: vi.fn() }));
vi.mock("@/lib/validation/schemas", () => ({ discoveryInputSchema: {} }));

import { sendApprovedDraft } from "@/lib/research/pipeline";

describe("sendApprovedDraft uncertain provider outcomes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.db.emailDraft.findUnique.mockResolvedValue({
      id: "draft", professorId: "professor", status: "APPROVED", resumeSha256: "fixture-hash",
      subject: "Fixture subject", body: "Fixture body", professor: {
        fullName: "Test Professor", email: "test@example.edu", evidence: [],
        researchTopics: "[]", relevanceScore: 90, insufficientEvidence: false,
      },
    });
    mocks.db.$transaction.mockImplementation(async (work) => work(mocks.db));
    mocks.db.emailSend.findFirst.mockResolvedValue(null);
    mocks.db.emailSend.create.mockResolvedValue({ id: "reservation" });
    mocks.db.emailSend.update.mockResolvedValue({ id: "reservation" });
  });

  it.each(["UNKNOWN", "500", "503"])("persists %s without releasing a retryable FAILED record", async (graphStatus) => {
    mocks.send.mockResolvedValue({ ok: false, dryRun: false, graphStatus, error: "Uncertain provider outcome" });
    await expect(sendApprovedDraft("draft")).rejects.toThrow("Uncertain provider outcome");
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.db.emailSend.update).toHaveBeenCalledWith({
      where: { id: "reservation" },
      data: expect.objectContaining({ status: "UNKNOWN", sentAt: null, dryRun: false, graphStatus }),
    });
    expect(mocks.db.emailDraft.update).toHaveBeenCalledWith({
      where: { id: "draft" }, data: expect.objectContaining({ status: "UNKNOWN", sentAt: null }),
    });
    expect(mocks.db.professor.update).toHaveBeenCalledWith({
      where: { id: "professor" }, data: expect.objectContaining({ status: "UNKNOWN" }),
    });
  });
});
