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
    `===== ${pkg.professorName} =====`,
    `College: ${pkg.college}`,
    `Professor email: ${pkg.professorEmail}`,
    `Research link: ${pkg.researchLink}`,
    `Resume attached: ${pkg.resumePath}`,
    ``,
    `Email header:`,
    pkg.emailHeader,
    ``,
    `Email:`,
    pkg.emailBody,
  ].join("\n");
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
  const researchLink =
    primaryResearchLink([...input.evidenceUrls, input.facultyPageUrl ?? ""].filter(Boolean)) ??
    input.facultyPageUrl ??
    input.evidenceUrls[0];
  if (!researchLink) return null;
  return {
    professorName: input.professorName,
    college: input.college,
    professorEmail: input.professorEmail,
    researchLink,
    emailHeader: input.subject,
    emailBody: input.body,
    resumePath: input.resumePath,
  };
}
