import { looksLikePersonName } from "@/lib/research/parser";
import { primaryResearchLink } from "@/lib/research/publications";

export type OutreachPackage = {
  professorName: string;
  college: string;
  professorEmail: string;
  researchLink: string;
  emailHeader: string;
  emailBody: string;
  resumePath: string;
};

export function formatOutreachPackage(pkg: OutreachPackage) {
  return [
    `professor's email: ${pkg.professorEmail}`,
    `research: ${pkg.researchLink}`,
    `professor name: ${pkg.professorName}`,
    `professor college: ${pkg.college}`,
    `email draft:`,
    `Subject: ${pkg.emailHeader}`,
    ``,
    pkg.emailBody.trim(),
  ].join("\n");
}

export function formatOutreachDoc(packages: OutreachPackage[]) {
  return packages.map((pkg) => formatOutreachPackage(pkg)).join("\n\n");
}

export function professorNameForDoc(name: string) {
  return name.replace(/^View\s+/i, "").trim();
}

export function outreachPackageFromDraft(input: {
  professorName: string;
  college: string;
  professorEmail: string | null;
  evidenceUrls: string[];
  facultyPageUrl?: string | null;
  subject: string;
  body: string;
  resumePath: string;
}): OutreachPackage | null {
  if (!input.professorEmail) return null;
  const professorName = professorNameForDoc(input.professorName);
  if (!looksLikePersonName(professorName)) return null;
  const researchLink =
    primaryResearchLink([...input.evidenceUrls, input.facultyPageUrl ?? ""].filter(Boolean)) ??
    input.facultyPageUrl ??
    input.evidenceUrls[0];
  if (!researchLink) return null;
  return {
    professorName,
    college: input.college,
    professorEmail: input.professorEmail,
    researchLink,
    emailHeader: input.subject,
    emailBody: input.body,
    resumePath: input.resumePath,
  };
}
