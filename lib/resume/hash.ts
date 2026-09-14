import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function hashResumePdf(resumePath: string) {
  const bytes = await readFile(resumePath);
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertResumeHashMatches(storedHash: string | null | undefined, currentHash: string) {
  if (!storedHash) {
    throw new Error("Draft approval is not bound to a resume file. Approve the draft again.");
  }
  if (storedHash !== currentHash) {
    throw new Error("Resume file changed after approval. Approve the draft again.");
  }
}
