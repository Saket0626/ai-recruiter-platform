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
