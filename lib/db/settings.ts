import { prisma } from "@/lib/db/prisma";

export async function getSetting(key: string, fallback: string) {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getAppSettings() {
  const envDefaults = await import("@/lib/config/env");
  const env = envDefaults.getEnv();
  const autoSend = await getSetting("AUTO_SEND", String(env.AUTO_SEND));
  const dryRun = await getSetting("DRY_RUN", String(env.DRY_RUN));
  const maxPerDay = await getSetting("MAX_EMAILS_PER_DAY", String(env.MAX_EMAILS_PER_DAY));
  const cooldown = await getSetting("PROFESSOR_COOLDOWN_DAYS", String(env.PROFESSOR_COOLDOWN_DAYS));
  const minScore = await getSetting("MIN_RELEVANCE_SCORE", String(env.MIN_RELEVANCE_SCORE));
  const autopilotMin = await getSetting("AUTOPILOT_MIN_SCORE", String(env.AUTOPILOT_MIN_SCORE));
  return {
    AUTO_SEND: autoSend === "true",
    // Only the canonical explicit opt-out may disable dry run.
    DRY_RUN: dryRun !== "false",
    MAX_EMAILS_PER_DAY: Number(maxPerDay),
    PROFESSOR_COOLDOWN_DAYS: Number(cooldown),
    MIN_RELEVANCE_SCORE: Number(minScore),
    AUTOPILOT_MIN_SCORE: Number(autopilotMin),
  };
}
