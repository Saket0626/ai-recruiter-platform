import { describe, expect, it } from "vitest";

function cooldownActive(lastSentAt: Date, cooldownDays: number, now = new Date()) {
  const days = (now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60 * 24);
  return days < cooldownDays;
}

function dailyCapReached(sentToday: number, cap: number) {
  return sentToday >= cap;
}

describe("rate limits and cooldown", () => {
  it("enforces a 90 day cooldown", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 10);
    expect(cooldownActive(recent, 90)).toBe(true);
    const old = new Date();
    old.setDate(old.getDate() - 91);
    expect(cooldownActive(old, 90)).toBe(false);
  });

  it("enforces a daily cap of 15", () => {
    expect(dailyCapReached(15, 15)).toBe(true);
    expect(dailyCapReached(14, 15)).toBe(false);
  });
});
