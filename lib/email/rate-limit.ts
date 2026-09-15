import { prisma } from "@/lib/db/prisma";
import { getAppSettings } from "@/lib/db/settings";
import { normalizeEmail } from "@/lib/security/email";
import { realContactStatuses } from "@/lib/email/send-gate";
import { dailySendCountWhere } from "@/lib/email/send-outcome";
import { cooldownActiveFrom, dailyCapReachedFromCount, jitterDelayMs } from "@/lib/email/rate-limit-policy";
import type { Prisma, PrismaClient } from "@prisma/client";

export { cooldownActiveFrom, dailyCapReachedFromCount, jitterDelayMs };

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function sentCountToday(db: DbClient = prisma) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return db.emailSend.count({
    where: dailySendCountWhere(start),
  });
}

export async function dailyCapReached() {
  const settings = await getAppSettings();
  return dailyCapReachedFromCount(await sentCountToday(), settings.MAX_EMAILS_PER_DAY);
}

export async function lastSendForRecipient(email: string, db: DbClient = prisma) {
  return db.emailSend.findFirst({
    where: {
      recipientNormalized: normalizeEmail(email),
      dryRun: false,
      OR: [{ status: { in: realContactStatuses() } }, { status: "SUBMITTING" }],
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function isInCooldown(email: string, db: DbClient = prisma) {
  const last = await lastSendForRecipient(email, db);
  if (!last) return false;
  if (last.status === "SUBMITTING" || last.status === "UNKNOWN") return true;
  if (!last.sentAt) return false;
  const settings = await getAppSettings();
  return cooldownActiveFrom(last.sentAt, settings.PROFESSOR_COOLDOWN_DAYS);
}
