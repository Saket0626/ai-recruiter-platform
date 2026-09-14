import { createHash, randomBytes } from "node:crypto";
import { base64UrlEncode } from "@/lib/google/pkce";

const FORBIDDEN_HEADER = /[\r\n]/;

export function assertSafeHeaderValue(name: string, value: string) {
  if (!value.trim() || FORBIDDEN_HEADER.test(value)) {
    throw new Error(`Email header ${name} is missing or contains a newline.`);
  }
}

export function encodeRfc2047Subject(subject: string) {
  assertSafeHeaderValue("Subject", subject);
  if (/^[\x20-\x7e]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function foldBase64(value: string) {
  return value.replace(/(.{76})/g, "$1\r\n").trim();
}

export function buildRfc822ResearchEmail(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
  filename: string;
  attachment: Buffer;
  boundary?: string;
}) {
  assertSafeHeaderValue("From", input.from);
  assertSafeHeaderValue("To", input.to);
  const filename = input.filename.replace(/[^\w.\-]+/g, "_") || "resume.pdf";
  const boundary = input.boundary ?? `rr_${randomBytes(12).toString("hex")}`;
  const bodyB64 = foldBase64(Buffer.from(input.body, "utf8").toString("base64"));
  const fileB64 = foldBase64(input.attachment.toString("base64"));
  const raw = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeRfc2047Subject(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    bodyB64,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${filename}"`,
    "",
    fileB64,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return { raw, boundary, filename };
}

export function encodeGmailRaw(rfc822: string) {
  return base64UrlEncode(Buffer.from(rfc822, "utf8"));
}

export function decodeGmailRaw(raw: string) {
  const padded = raw.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((raw.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

export function extractPdfAttachment(rfc822: string) {
  const match = rfc822.match(/Content-Type: application\/pdf[\s\S]*?\r\n\r\n([\s\S]*?)\r\n--/);
  if (!match?.[1]) throw new Error("MIME message is missing a PDF attachment.");
  return Buffer.from(match[1].replace(/\s+/g, ""), "base64");
}

export function messageFingerprint(rfc822: string) {
  return createHash("sha256").update(rfc822).digest("hex");
}
