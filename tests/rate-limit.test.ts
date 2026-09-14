import { describe, expect, it } from "vitest";
import { cooldownActiveFrom, dailyCapReachedFromCount, jitterDelayMs } from "@/lib/email/rate-limit-policy";

describe("production rate limits and cooldown", () => {
  it("enforces a 90 day cooldown using the production helper", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 10);
    expect(cooldownActiveFrom(recent, 90)).toBe(true);
    const old = new Date();
    old.setDate(old.getDate() - 91);
    expect(cooldownActiveFrom(old, 90)).toBe(false);
  });

  it("enforces a daily cap of 15 using the production helper", () => {
    expect(dailyCapReachedFromCount(15, 15)).toBe(true);
    expect(dailyCapReachedFromCount(14, 15)).toBe(false);
  });

  it("returns a positive jitter delay from the production helper", () => {
    const delay = jitterDelayMs();
    expect(delay).toBeGreaterThanOrEqual(1500);
    expect(delay).toBeLessThan(5000);
  });
});
