import type { StudentProfile } from "@/lib/validation/schemas";

const UPGRADE_PAIRS: Array<[RegExp, RegExp]> = [
  [/\bhelped\b/i, /\b(built|created|developed|led|architected)\b/i],
  [/\bcontributed to\b/i, /\b(created|built|founded|invented)\b/i],
  [/\busing ai to help\b/i, /\b(built an ai|created an ai|developed an ai system)\b/i],
  [/\bassist(ed)?\b/i, /\b(led|owned|created|built)\b/i],
];

export function collectResumeCorpus(profile: StudentProfile) {
  return [
    profile.resumeText,
    profile.name,
    profile.university,
    profile.degree,
    profile.minor,
    profile.graduationDate,
    profile.currentStatus,
    ...profile.technicalSkills,
    ...profile.accomplishments,
    ...profile.experiences.map((item) => `${item.organization} ${item.role} ${item.summary}`),
    ...profile.projects.map((item) => `${item.name} ${item.summary} ${item.technologies.join(" ")}`),
  ]
    .join("\n")
    .toLowerCase();
}

export function isResumeSupportedClaim(claim: string, profile: StudentProfile): {
  ok: boolean;
  reason?: string;
} {
  const corpus = collectResumeCorpus(profile);
  const lower = claim.toLowerCase();
  const namedProjects = profile.projects.map((project) => project.name.toLowerCase());
  const namedOrgs = profile.experiences.map((experience) => experience.organization.toLowerCase());

  for (const [resumeVerb, claimVerb] of UPGRADE_PAIRS) {
    if (claimVerb.test(claim) && resumeVerb.test(profile.resumeText) && !claimVerb.test(profile.resumeText)) {
      if (namedProjects.some((name) => lower.includes(name)) || namedOrgs.some((name) => lower.includes(name))) {
        return {
          ok: false,
          reason: `Claim upgrades resume wording: "${claim}"`,
        };
      }
    }
  }

  const tokens = lower
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3);

  const distinctive = tokens.filter(
    (token) =>
      ![
        "with",
        "that",
        "this",
        "from",
        "have",
        "been",
        "your",
        "their",
        "about",
        "using",
        "student",
        "research",
        "interested",
        "learning",
        "experience",
      ].includes(token),
  );

  const mentionedEntity =
    namedProjects.some((name) => lower.includes(name)) ||
    namedOrgs.some((name) => lower.includes(name)) ||
    profile.technicalSkills.some((skill) => lower.includes(skill.toLowerCase())) ||
    lower.includes(profile.name.toLowerCase()) ||
    lower.includes("first-year") ||
    lower.includes("ut dallas") ||
    lower.includes("computer information systems");

  if (!mentionedEntity && distinctive.length > 4) {
    const overlap = distinctive.filter((token) => corpus.includes(token)).length;
    if (overlap < Math.min(3, distinctive.length)) {
      return { ok: false, reason: `Unsupported student claim: "${claim}"` };
    }
  }

  if (/\b(built|created|founded|invented)\b/i.test(claim) && /\bclinicalhours\b/i.test(claim)) {
    if (!/\b(built|created|founded|invented)\b/i.test(profile.resumeText)) {
      return {
        ok: false,
        reason: "Resume does not support independently building ClinicalHours",
      };
    }
  }

  return { ok: true };
}

export function extractStudentClaims(emailBody: string) {
  return emailBody
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) =>
      /clinicalhours|canvas companion|chartwise|cloud of goods|python|typescript|resume|helped|project|website|pipeline/i.test(
        line,
      ),
    );
}
