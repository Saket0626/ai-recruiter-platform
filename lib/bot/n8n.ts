import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { professorDisplayName } from "@/lib/bot/identity";
import type { OutreachPackage } from "@/lib/bot/packages";
import { logger } from "@/lib/logging/logger";
import { normalizeEmail } from "@/lib/security/email";

export const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL?.trim() || "https://saketamanana.app.n8n.cloud/webhook/professor-outreach";

export const N8N_POST_DELAY_MS = 7000;
export const N8N_DAILY_CAP = 400;

export type N8nOutreachPayload = {
  professor_email: string;
  professor_name: string;
  draft_subject: string;
  draft_body: string;
};

function logPath() {
  return path.join(process.cwd(), "data/outbox/n8n-webhook.log");
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function n8nPayloadFromPackage(pkg: OutreachPackage): N8nOutreachPayload {
  return {
    professor_email: pkg.professorEmail,
    professor_name: professorDisplayName(pkg.professorName),
    draft_subject: pkg.emailHeader,
    draft_body: pkg.emailBody,
  };
}

export async function alreadyPostedToN8n(email: string) {
  try {
    const text = await readFile(logPath(), "utf8");
    const needle = `professor_email=${normalizeEmail(email)}`;
    return text
      .split("\n")
      .some((line) => line.toLowerCase().includes(needle.toLowerCase()) && /status=2\d\d/.test(line));
  } catch {
    return false;
  }
}

export async function postedCountToday() {
  try {
    const text = await readFile(logPath(), "utf8");
    const day = todayStamp();
    return text.split("\n").filter((line) => line.includes(`date=${day}`) && /status=2\d\d/.test(line)).length;
  } catch {
    return 0;
  }
}

async function writeLog(line: string) {
  await mkdir(path.dirname(logPath()), { recursive: true });
  await appendFile(logPath(), `${line}\n`);
}

export async function postProfessorToN8n(pkg: OutreachPackage): Promise<{
  professor_email: string;
  status: number;
  ok: boolean;
  skipped?: string;
}> {
  const payload = n8nPayloadFromPackage(pkg);
  const email = normalizeEmail(payload.professor_email);
  if (!email || !payload.professor_name || !payload.draft_subject || !payload.draft_body) {
    return { professor_email: payload.professor_email, status: 0, ok: false, skipped: "missing_required_field" };
  }
  if (await alreadyPostedToN8n(email)) {
    return { professor_email: email, status: 200, ok: true, skipped: "already_posted" };
  }
  if ((await postedCountToday()) >= N8N_DAILY_CAP) {
    const skipped = "daily_cap";
    await writeLog(`${new Date().toISOString()} date=${todayStamp()} professor_email=${email} status=0 skipped=${skipped}`);
    logger.warn("n8n_daily_cap", { professor_email: email, cap: N8N_DAILY_CAP });
    return { professor_email: email, status: 0, ok: false, skipped };
  }

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const status = response.status;
    await writeLog(
      `${new Date().toISOString()} date=${todayStamp()} professor_email=${email} status=${status}`,
    );
    logger.info("n8n_webhook_posted", { professor_email: email, status });
    console.log(`N8N POST | ${email} | status=${status}`);
    return { professor_email: email, status, ok: response.ok };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network_error";
    await writeLog(`${new Date().toISOString()} date=${todayStamp()} professor_email=${email} status=0 error=${message}`);
    logger.warn("n8n_webhook_failed", { professor_email: email, error: message });
    console.log(`N8N POST | ${email} | status=0 | ${message}`);
    return { professor_email: email, status: 0, ok: false };
  }
}

export function webhookDelay() {
  return new Promise((resolve) => setTimeout(resolve, N8N_POST_DELAY_MS));
}
