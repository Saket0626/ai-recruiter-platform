const GENERIC_LOCAL_PARTS = new Set([
  "info",
  "admissions",
  "admission",
  "department",
  "dept",
  "support",
  "contact",
  "office",
  "webmaster",
  "admin",
  "help",
  "staff",
  "hr",
  "recruiting",
  "news",
  "media",
  "alumni",
  "undergraduate",
  "graduate",
    "dean",
    "chair",
    "cs-dept",
    "cis",
    "helpdesk",
    "noreply",
    "no-reply",
    "postmaster",
    "oea",
    "general",
    "affairs",
    "directory",
  ]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailShape(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function isGenericInbox(email: string): boolean {
  if (!isValidEmailShape(email)) return true;
  const local = normalizeEmail(email).split("@")[0] ?? "";
  const localRoot = local.split("+")[0] ?? "";
  if (GENERIC_LOCAL_PARTS.has(localRoot)) return true;
  if (localRoot.endsWith("-office") || localRoot.endsWith("-info") || localRoot.endsWith("-general")) return true;
  if (localRoot.includes("department") || localRoot.includes("admissions") || localRoot.includes("general")) return true;
  if (localRoot.includes("uncomment") || localRoot.startsWith("to") && localRoot.includes("comment")) return true;
  return false;
}

export function extractEmails(text: string): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const unique = new Set(matches.map(normalizeEmail));
  return [...unique];
}

export function preferUniversityEmail(emails: string[], universityDomain?: string | null) {
  const valid = emails.filter(isValidEmailShape);
  if (universityDomain) {
    const domain = universityDomain.replace(/^www\./, "").toLowerCase();
    const campus = valid.filter((email) => email.endsWith(`@${domain}`) || email.endsWith(`.${domain}`));
    const personal = campus.filter((email) => !isGenericInbox(email));
    if (personal[0]) return personal[0];
    if (campus[0]) return campus[0];
  }
  const nonGeneric = valid.filter((email) => !isGenericInbox(email));
  return nonGeneric[0] ?? valid[0] ?? null;
}

export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const url = new URL(raw, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function identityKey(input: {
  emailNormalized?: string | null;
  facultyPageUrlNormalized?: string | null;
  university: string;
  fullName: string;
}) {
  if (input.emailNormalized) return `email:${input.emailNormalized}`;
  if (input.facultyPageUrlNormalized) return `url:${input.facultyPageUrlNormalized}`;
  return `name:${input.university.trim().toLowerCase()}|${input.fullName.trim().toLowerCase()}`;
}
