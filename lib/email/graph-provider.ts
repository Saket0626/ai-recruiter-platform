import { readFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logging/logger";
import { getAppSettings } from "@/lib/db/settings";
import {
  buildGraphSendMailPayload,
  buildResumeAttachment,
  graphErrorMessage,
  parseRetryAfter,
} from "@/lib/microsoft/graph";
import { acquireGraphToken } from "@/lib/microsoft/msal";
import { GRAPH_SEND_MAIL_URL } from "@/lib/microsoft/scopes";
import { resumeExists } from "@/lib/resume/service";
import type { EmailProvider, SendRequest, SendResult } from "@/lib/email/provider";

export class GraphEmailProvider implements EmailProvider {
  async sendResearchEmail(request: SendRequest): Promise<SendResult> {
    if (!resumeExists(request.resumePath)) {
      return { ok: false, dryRun: false, graphStatus: null, error: "Resume file is missing." };
    }
    const bytes = await readFile(request.resumePath);
    const payload = buildGraphSendMailPayload({
      subject: request.subject,
      body: request.body,
      recipient: request.recipient,
      attachment: buildResumeAttachment({
        filename: path.basename(request.resumePath) || "resume.pdf",
        bytes,
      }),
    });

    const settings = await getAppSettings();
    if (settings.DRY_RUN) {
      logger.info("send_dry_run", {
        recipient: request.recipient,
        subject: request.subject,
        attachmentName: path.basename(request.resumePath),
        bytes: bytes.length,
      });
      return { ok: true, dryRun: true, graphStatus: "DRY_RUN" };
    }

    const token = await acquireGraphToken();
    logger.info("send_attempt", { recipient: request.recipient, subject: request.subject });
    const response = await fetch(GRAPH_SEND_MAIL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 202) {
      logger.info("send_success", { recipient: request.recipient, graphStatus: "202" });
      return { ok: true, dryRun: false, graphStatus: "202" };
    }

    const errorBody = await response.text();
    if (response.status === 429) {
      const retry = parseRetryAfter(response.headers.get("retry-after"));
      logger.warn("send_throttled", { recipient: request.recipient, retryAfterMs: retry });
      return {
        ok: false,
        dryRun: false,
        graphStatus: "429",
        error: graphErrorMessage(429, errorBody),
      };
    }
    logger.error("send_failure", { recipient: request.recipient, graphStatus: String(response.status) });
    return {
      ok: false,
      dryRun: false,
      graphStatus: String(response.status),
      error: graphErrorMessage(response.status, errorBody),
    };
  }
}
