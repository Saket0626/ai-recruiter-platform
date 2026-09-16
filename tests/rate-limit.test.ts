import { describe, expect, it } from "vitest";
import {
  boundedDailyLimit,
  cooldownActiveFrom,
  dailyCapReachedFromCount,
  jitterDelayMs,
  startOfSendDay,
} from "@/lib/email/rate-limit-policy";

describe("production rate limits and cooldown", () => {
  it("enforces a 90 day cooldown using the production helper", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 10);
    expect(cooldownActiveFrom(recent, 90)).toBe(true);
    const old = new Date();
    old.setDate(old.getDate() - 91);
    expect(cooldownActiveFrom(old, 90)).toBe(false);
  });

  it("enforces a daily cap of 20 using the production helper", () => {
    expect(dailyCapReachedFromCount(20, 20)).toBe(true);
    expect(dailyCapReachedFromCount(19, 20)).toBe(false);
  });

  it("never accepts a configured daily limit above 20", () => {
    expect(boundedDailyLimit(100)).toBe(20);
    expect(boundedDailyLimit("21")).toBe(20);
    expect(boundedDailyLimit("not-a-number")).toBe(20);
    expect(boundedDailyLimit(8)).toBe(8);
  });

  it("returns a positive jitter delay from the production helper", () => {
    const delay = jitterDelayMs();
    expect(delay).toBeGreaterThanOrEqual(1500);
    expect(delay).toBeLessThan(5000);
  });

  it("starts the send day at America/Chicago midnight", () => {
    const start = startOfSendDay(new Date("2026-09-15T18:00:00-05:00"));
    expect(start.toISOString()).toBe("2026-09-15T05:00:00.000Z");
  });
});
