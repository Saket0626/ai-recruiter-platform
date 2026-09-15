import { existsSync } from "node:fs";
import { parseResumeText } from "@/lib/resume/parser";
import { resolveResumePath as resolveExistingResumePath } from "@/lib/resume/paths";
import { mergeStudentProfile, parseStudentIdentityOverrides } from "@/lib/resume/profile-overrides";
import { getSetting } from "@/lib/db/settings";
import type { StudentProfile } from "@/lib/validation/schemas";

export { resolveResumePath } from "@/lib/resume/paths";

export function resumeExists(resumePath = resolveExistingResumePath()) {
  return existsSync(resumePath);
}

export async function extractPdfText(resumePath: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const { extractText, getDocumentProxy } = await import("unpdf");
  const bytes = await readFile(resumePath);
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const result = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
  return text.replace(/\r/g, "").trim();
}

export async function loadStudentProfile(resumePath = resolveExistingResumePath()): Promise<
  { ok: true; profile: StudentProfile } | { ok: false; error: string; resumePath: string }
> {
  if (!resumeExists(resumePath)) {
    return {
      ok: false,
      resumePath,
      error: `Resume not found at ${resumePath}. Place a PDF at data/resume.pdf or set RESUME_PATH. Sending is disabled until a resume is available.`,
    };
  }
  try {
    const resumeText = await extractPdfText(resumePath);
    if (resumeText.length < 40) {
      return {
        ok: false,
        resumePath,
        error: "The resume PDF was found but almost no text could be extracted. Export a text-based PDF, not a scanned image.",
      };
    }
    const parsed = parseResumeText(resumeText, resumePath);
    let overrides = {};
    try {
      overrides = parseStudentIdentityOverrides(await getSetting("STUDENT_PROFILE_OVERRIDES", "{}"));
    } catch {
      overrides = {};
    }
    return { ok: true, profile: mergeStudentProfile(parsed, overrides) };
  } catch (error) {
    return {
      ok: false,
      resumePath,
      error: error instanceof Error ? error.message : "Failed to parse resume PDF",
    };
  }
}
