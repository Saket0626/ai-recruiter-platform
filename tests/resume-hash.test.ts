import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { assertResumeHashMatches, hashResumePdf } from "@/lib/resume/hash";
import { assertDraftSendable } from "@/lib/email/send-gate";

async function writePdf(dir: string, name: string, line: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([200, 200]);
  page.drawText(line, { x: 20, y: 160, size: 12 });
  const dest = path.join(dir, name);
  writeFileSync(dest, await pdf.save());
  return dest;
}

describe("resume approval hash binding", () => {
  let dir: string;

  beforeEach(() => {
    dir = path.join(os.tmpdir(), `rr-resume-hash-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a stale approval when the resume PDF bytes change", async () => {
    const first = await writePdf(dir, "a.pdf", "ClinicalHours intern fixture A");
    const second = await writePdf(dir, "b.pdf", "ClinicalHours intern fixture B different");
    const hashA = await hashResumePdf(first);
    const hashB = await hashResumePdf(second);
    expect(hashA).not.toEqual(hashB);
    expect(() => assertResumeHashMatches(hashA, hashB)).toThrow(/changed after approval/i);
    expect(() =>
      assertDraftSendable({
        status: "APPROVED",
        autoSend: false,
        resumeSha256: hashA,
        currentResumeSha256: hashB,
      }),
    ).toThrow(/changed after approval/i);
    expect(() =>
      assertDraftSendable({
        status: "APPROVED",
        autoSend: false,
        resumeSha256: hashA,
        currentResumeSha256: hashA,
      }),
    ).not.toThrow();
  });
});
