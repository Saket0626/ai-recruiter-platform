import { readFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/config/env";
import { getAppSettings } from "@/lib/db/settings";
import { acquireGmailAccessToken } from "@/lib/google/oauth";
import { GMAIL_MESSAGES_SEND_URL } from "@/lib/google/scopes";
import { logger } from "@/lib/logging/logger";
import { resumeExists } from "@/lib/resume/service";
import { parseRetryAfter } from "@/lib/microsoft/graph";
import { buildRfc822ResearchEmail, encodeGmailRaw } from "@/lib/email/mime";
import type { EmailProvider, SendRequest, SendResult } from "@/lib/email/provider";

export function gmailErrorMessage(status: number, body: string) {
  if (status === 401) return "Gmail session expired. Reconnect Gmail.";
  if (status === 403) {
    if (/insufficient|accessNotConfigured|Gmail API has not been used/i.test(body)) {
      return "Gmail API is not enabled or the send scope was not granted. Enable Gmail API and reconnect.";
    }
    return "Gmail denied send access. Reconnect and confirm gmail.send is granted.";
  }
  if (status === 429) return "Gmail throttled the request. Wait for Retry-After and try again.";
  return `Gmail messages.send failed with HTTP ${status}.`;
}

export class GmailEmailProvider implements EmailProvider {
  constructor(
    private readonly deps: {
      fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
      acquireToken?: typeof acquireGmailAccessToken;
    } = {},
  ) {}

  async sendResearchEmail(request: SendRequest): Promise<SendResult> {
    if (!resumeExists(request.resumePath)) {
      return { ok: false, dryRun: false, graphStatus: null, error: "Resume file is missing." };
    }
    const env = getEnv();
    const bytes = await readFile(request.resumePath);
    const mime = buildRfc822ResearchEmail({
      from: env.GOOGLE_ALLOWED_EMAIL,
      to: request.recipient,
      subject: request.subject,
      body: request.body,
      filename: path.basename(request.resumePath) || "resume.pdf",
      attachment: bytes,
    });
    const raw = encodeGmailRaw(mime.raw);
    const settings = await getAppSettings();
    if (settings.DRY_RUN) {
      logger.info("send_dry_run", {
        recipient: request.recipient,
        subject: request.subject,
        attachmentName: mime.filename,
        bytes: bytes.length,
        provider: "gmail",
      });
      return { ok: true, dryRun: true, graphStatus: "DRY_RUN" };
    }

    let token;
    try {
      token = await (this.deps.acquireToken ?? acquireGmailAccessToken)();
    } catch (error) {
      return {
        ok: false,
        dryRun: false,
        graphStatus: "AUTH",
        error: error instanceof Error ? error.message : "Gmail is not connected.",
      };
    }
    if (token.email.toLowerCase() !== env.GOOGLE_ALLOWED_EMAIL.toLowerCase()) {
      return {
        ok: false,
        dryRun: false,
        graphStatus: "AUTH",
        error: `Connected Gmail ${token.email} is not the allowed sender ${env.GOOGLE_ALLOWED_EMAIL}.`,
      };
    }

    logger.info("send_attempt", { recipient: request.recipient, subject: request.subject, provider: "gmail" });
    const fetchImpl = this.deps.fetchImpl ?? fetch;
    let response: Response;
    try {
      response = await fetchImpl(GMAIL_MESSAGES_SEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });
    } catch {
      return {
        ok: false,
        dryRun: false,
        graphStatus: "UNKNOWN",
        error: "Gmail send was interrupted before a response. Check Sent history before retrying.",
      };
    }

    if (response.ok) {
      logger.info("send_success", { recipient: request.recipient, graphStatus: String(response.status) });
      return { ok: true, dryRun: false, graphStatus: String(response.status) };
    }

    const errorBody = await response.text();
    if (response.status === 429) {
      const retry = parseRetryAfter(response.headers.get("retry-after"));
      logger.warn("send_throttled", { recipient: request.recipient, retryAfterMs: retry });
    } else {
      logger.error("send_failure", { recipient: request.recipient, graphStatus: String(response.status) });
    }
    return {
      ok: false,
      dryRun: false,
      graphStatus: String(response.status),
      error: gmailErrorMessage(response.status, errorBody),
    };
  }
}
