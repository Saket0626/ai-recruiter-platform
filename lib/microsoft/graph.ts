export type GraphFileAttachment = {
  "@odata.type": "#microsoft.graph.fileAttachment";
  name: string;
  contentType: string;
  contentBytes: string;
};

export type GraphSendMailPayload = {
  message: {
    subject: string;
    body: { contentType: "Text" | "HTML"; content: string };
    toRecipients: Array<{ emailAddress: { address: string } }>;
    attachments: GraphFileAttachment[];
  };
  saveToSentItems: boolean;
};

export function buildResumeAttachment(input: { filename: string; bytes: Buffer }): GraphFileAttachment {
  return {
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: input.filename,
    contentType: "application/pdf",
    contentBytes: input.bytes.toString("base64"),
  };
}

export function buildGraphSendMailPayload(input: {
  subject: string;
  body: string;
  recipient: string;
  attachment: GraphFileAttachment;
  saveToSentItems?: boolean;
}): GraphSendMailPayload {
  return {
    message: {
      subject: input.subject,
      body: { contentType: "Text", content: input.body },
      toRecipients: [{ emailAddress: { address: input.recipient } }],
      attachments: [input.attachment],
    },
    saveToSentItems: input.saveToSentItems ?? true,
  };
}

export function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}

export function graphErrorMessage(status: number, body: string) {
  if (status === 401) return "Microsoft session expired. Connect Outlook again.";
  if (status === 403) {
    if (/AADSTS65001|consent/i.test(body)) {
      return "Your Microsoft tenant blocked user consent. An admin must grant Mail.Send and User.Read for this app.";
    }
    return "Microsoft Graph denied Mail.Send. Check Entra permissions and admin consent.";
  }
  if (status === 429) return "Microsoft Graph throttled the request. Wait for Retry-After and try again.";
  return `Microsoft Graph sendMail failed with HTTP ${status}.`;
}
