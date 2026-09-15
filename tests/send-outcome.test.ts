import { describe, expect, it, vi } from "vitest";
import { dailySendCountWhere, persistedSendStatus } from "@/lib/email/send-outcome";

const db = vi.hoisted(() => ({ count: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { emailSend: db } }));
vi.mock("@/lib/db/settings", () => ({
  getAppSettings: async () => ({ MAX_EMAILS_PER_DAY: 20, PROFESSOR_COOLDOWN_DAYS: 90 }),
}));

import { isInCooldown, sentCountToday } from "@/lib/email/rate-limit";

describe("uncertain send persistence", () => {
  it.each(["UNKNOWN", "500", "502", "503", "504"])("preserves %s as UNKNOWN", (graphStatus) => {
    expect(persistedSendStatus({ ok: false, dryRun: false, graphStatus })).toBe("UNKNOWN");
  });

  it.each(["AUTH", "400", "401", "403", "429"])("keeps explicit rejection %s FAILED", (graphStatus) => {
    expect(persistedSendStatus({ ok: false, dryRun: false, graphStatus })).toBe("FAILED");
  });

  it("keeps accepted and dry-run results distinct", () => {
    expect(persistedSendStatus({ ok: true, dryRun: false, graphStatus: "200" })).toBe("SENT");
    expect(persistedSendStatus({ ok: true, dryRun: true, graphStatus: "DRY_RUN" })).toBe("DRY_RUN");
  });

  it("the production daily query counts UNKNOWN by reservation date, never null sentAt", async () => {
    db.count.mockResolvedValueOnce(20);
    expect(await sentCountToday()).toBe(20);
    const { where } = db.count.mock.calls.at(-1)![0];
    expect(where.dryRun).toBe(false);
    const uncertain = where.OR.find((entry: { status: { in: string[] } }) => entry.status.in.includes("UNKNOWN"));
    expect(uncertain.createdAt.gte).toBeInstanceOf(Date);
    expect(uncertain).not.toHaveProperty("sentAt");
    expect(where).toEqual(dailySendCountWhere(uncertain.createdAt.gte));
  });

  it("unresolved UNKNOWN blocks another draft for the recipient even after cooldown duration", async () => {
    db.findFirst.mockResolvedValueOnce({ status: "UNKNOWN", sentAt: null, createdAt: new Date("2020-01-01") });
    expect(await isInCooldown(" TEST@EXAMPLE.EDU ")).toBe(true);
    expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ recipientNormalized: "test@example.edu", dryRun: false }),
    }));
  });
});
