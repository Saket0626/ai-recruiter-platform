import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";
import { normalizeEmail } from "@/lib/security/email";

export async function sentCountToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.emailSend.count({
    where: {
      sentAt: { gte: start },
      status: { in: ["SENT", "DRY_RUN"] },
    },
  });
}

export async function dailyCapReached() {
  const env = getEnv();
  return (await sentCountToday()) >= env.MAX_EMAILS_PER_DAY;
}

export async function lastSendForRecipient(email: string) {
  return prisma.emailSend.findFirst({
    where: { recipientNormalized: normalizeEmail(email), status: { in: ["SENT", "DRY_RUN"] } },
    orderBy: { sentAt: "desc" },
  });
}

export async function isInCooldown(email: string) {
  const last = await lastSendForRecipient(email);
  if (!last?.sentAt) return false;
  const days = (Date.now() - last.sentAt.getTime()) / (1000 * 60 * 60 * 24);
  return days < getEnv().PROFESSOR_COOLDOWN_DAYS;
}

export function jitterDelayMs() {
  return 1500 + Math.floor(Math.random() * 2500);
}
