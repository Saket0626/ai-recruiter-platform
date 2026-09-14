import { prisma } from "@/lib/db/prisma";
import { getAppSettings } from "@/lib/db/settings";
import { normalizeEmail } from "@/lib/security/email";
import { realContactStatuses } from "@/lib/email/send-gate";
import { cooldownActiveFrom, dailyCapReachedFromCount, jitterDelayMs } from "@/lib/email/rate-limit-policy";

export { cooldownActiveFrom, dailyCapReachedFromCount, jitterDelayMs };

export async function sentCountToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.emailSend.count({
    where: {
      dryRun: false,
      OR: [
        { status: { in: realContactStatuses() }, sentAt: { gte: start } },
        { status: "SUBMITTING", createdAt: { gte: start } },
      ],
    },
  });
}

export async function dailyCapReached() {
  const settings = await getAppSettings();
  return dailyCapReachedFromCount(await sentCountToday(), settings.MAX_EMAILS_PER_DAY);
}

export async function lastSendForRecipient(email: string) {
  return prisma.emailSend.findFirst({
    where: {
      recipientNormalized: normalizeEmail(email),
      dryRun: false,
      OR: [{ status: { in: realContactStatuses() } }, { status: "SUBMITTING" }],
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function isInCooldown(email: string) {
  const last = await lastSendForRecipient(email);
  if (!last) return false;
  if (last.status === "SUBMITTING" || last.status === "UNKNOWN") return true;
  if (!last.sentAt) return false;
  const settings = await getAppSettings();
  return cooldownActiveFrom(last.sentAt, settings.PROFESSOR_COOLDOWN_DAYS);
}
