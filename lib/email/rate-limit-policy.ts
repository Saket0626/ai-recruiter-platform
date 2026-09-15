export const SEND_DAY_TIMEZONE = "America/Chicago";

export function startOfSendDay(now = new Date(), timeZone = SEND_DAY_TIMEZONE) {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  for (const offset of ["-05:00", "-06:00"]) {
    const candidate = new Date(`${dateKey}T00:00:00${offset}`);
    const keyAtCandidate = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(candidate);
    const hourAtCandidate = Number(
      new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(candidate),
    );
    if (keyAtCandidate === dateKey && hourAtCandidate === 0) return candidate;
  }
  return new Date(`${dateKey}T05:00:00.000Z`);
}

export function cooldownActiveFrom(lastSentAt: Date, cooldownDays: number, now = new Date()) {
  const days = (now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60 * 24);
  return days < cooldownDays;
}

export function dailyCapReachedFromCount(sentToday: number, cap: number) {
  return sentToday >= cap;
}

export function jitterDelayMs() {
  return 1500 + Math.floor(Math.random() * 2500);
}
