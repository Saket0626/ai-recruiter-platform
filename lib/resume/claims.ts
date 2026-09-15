import type { StudentProfile } from "@/lib/validation/schemas";

const UPGRADE_PAIRS: Array<[RegExp, RegExp]> = [
  [/\bhelped\b/i, /\b(built|created|developed|led|architected)\b/i],
  [/\bcontributed to\b/i, /\b(created|built|founded|invented)\b/i],
  [/\busing ai to help\b/i, /\b(built an ai|created an ai|developed an ai system)\b/i],
  [/\bassist(ed)?\b/i, /\b(led|owned|created|built)\b/i],
];

const STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "been",
  "being",
  "between",
  "could",
  "development",
  "during",
  "each",
  "experience",
  "from",
  "have",
  "help",
  "helped",
  "into",
  "interested",
  "just",
  "learning",
  "more",
  "most",
  "only",
  "other",
  "over",
  "project",
  "projects",
  "recently",
  "research",
  "should",
  "some",
  "student",
  "such",
  "than",
  "that",
  "their",
  "then",
  "these",
  "this",
  "those",
  "through",
  "under",
  "using",
  "website",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
]);

type NamedEntity = {
  name: string;
  text: string;
};

function namedEntities(profile: StudentProfile): NamedEntity[] {
  const sentences = profile.resumeText.split(/\n+|(?<=[.!?])\s+/);
  const related = (name: string) =>
    sentences.filter((sentence) => sentence.toLowerCase().includes(name.toLowerCase())).join(" ");
  return [
    ...profile.projects.map((project) => ({
      name: project.name,
      text: `${project.name} ${project.summary} ${project.technologies.join(" ")} ${related(project.name)}`.toLowerCase(),
    })),
    ...profile.experiences.map((experience) => ({
      name: experience.organization,
      text: `${experience.organization} ${experience.role ?? ""} ${experience.summary} ${related(experience.organization)}`.toLowerCase(),
    })),
  ];
}

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

function claimTokens(claim: string) {
  return claim
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !STOPWORDS.has(token));
}

function reservedForeignTokens(profile: StudentProfile, entityName: string) {
  const tokens = new Set<string>();
  const add = (value: string) => {
    for (const part of value.toLowerCase().split(/[^a-z0-9+#]+/)) {
      if (part.length > 3 && !STOPWORDS.has(part)) tokens.add(part);
    }
  };
  for (const skill of profile.technicalSkills) add(skill);
  for (const project of profile.projects) {
    if (project.name.toLowerCase() === entityName.toLowerCase()) continue;
    add(project.name);
    for (const tech of project.technologies) add(tech);
  }
  for (const experience of profile.experiences) {
    if (experience.organization.toLowerCase() === entityName.toLowerCase()) continue;
    if (experience.organization.trim().split(/\s+/).length > 4) continue;
    add(experience.organization);
  }
  return tokens;
}

export function isResumeSupportedClaim(claim: string, profile: StudentProfile): {
  ok: boolean;
  reason?: string;
} {
  const corpus = collectResumeCorpus(profile);
  const lower = claim.toLowerCase();
  if (/(88k|88,000|70%)/i.test(claim) && !/(88k|88,000|70%)/i.test(profile.resumeText)) {
    return {
      ok: false,
      reason: "Resume does not support the 88K-record pipeline or 70% ClinicalHours claims.",
    };
  }
  const entities = namedEntities(profile);

  for (const [resumeVerb, claimVerb] of UPGRADE_PAIRS) {
    if (claimVerb.test(claim) && resumeVerb.test(profile.resumeText) && !claimVerb.test(profile.resumeText)) {
      if (entities.some((entity) => lower.includes(entity.name.toLowerCase()))) {
        return {
          ok: false,
          reason: `Claim upgrades resume wording: "${claim}"`,
        };
      }
    }
  }

  const mentioned = entities.filter((entity) => lower.includes(entity.name.toLowerCase()));
  if (mentioned.length) {
    for (const entity of mentioned) {
      const entityWords = new Set(entity.name.toLowerCase().split(/\s+/));
      const extras = claimTokens(claim).filter((token) => !entityWords.has(token));
      const foreign = reservedForeignTokens(profile, entity.name);
      const leaked = extras.filter((token) => foreign.has(token) && !entity.text.includes(token));
      if (leaked.length) {
        return {
          ok: false,
          reason: `Claim uses "${leaked[0]}" with ${entity.name}, but that is not in the recorded ${entity.name} summary or technologies.`,
        };
      }
    }
    return { ok: true };
  }

  const distinctive = claimTokens(claim);
  const mentionedSkill =
    profile.technicalSkills.some((skill) => lower.includes(skill.toLowerCase())) ||
    lower.includes(profile.name.toLowerCase()) ||
    lower.includes("first-year") ||
    lower.includes("ut dallas") ||
    lower.includes("computer information systems");

  if (!mentionedSkill && distinctive.length > 4) {
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
