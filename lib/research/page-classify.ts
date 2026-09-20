export type PageTextClass =
  | "RESEARCH_AREA"
  | "PROJECT"
  | "PUBLICATION_TITLE"
  | "PUBLICATION_ABSTRACT"
  | "LAB_DESCRIPTION"
  | "BIOGRAPHY"
  | "COURSE"
  | "COURSE_SCHEDULE"
  | "ROOM_LOCATION"
  | "NAVIGATION"
  | "PAGE_HEADING"
  | "CONTACT_INFORMATION"
  | "NEWS"
  | "AWARD"
  | "ADMINISTRATIVE_TEXT"
  | "UNKNOWN";

const EMAIL_SAFE: ReadonlySet<PageTextClass> = new Set([
  "RESEARCH_AREA",
  "PROJECT",
  "PUBLICATION_TITLE",
  "PUBLICATION_ABSTRACT",
  "LAB_DESCRIPTION",
]);

const COURSE_SCHEDULE =
  /\b(TuTh|Tu-Th|TTh|MWF|M\/W\/F|MoWeFr)\b|\b\d{1,2}:\d{2}(-\d{1,2}:\d{2})?\b|\b(Fall|Spring|Summer)\s+20\d{2}\b/i;

const ROOM_LOCATION = /\b(Cory|Room|Rm\.?|Bldg\.?|Building)\s+\d{2,}\b|\boffice hours\b/i;

const NAVIGATION =
  /\b(menu search|search form|search apply|apply \/ inquire|contact us|connect connect|faculty & lecturers|staff offices|all people|skip to|home\s+about\s+people|department of chemistry department of computer science|margaret tarpo|rossin college)\b/i;

const PAGE_HEADING =
  /^(selected publications|publications|teaching|courses|biography|students|news|research|contact|home|people)\b|\bselected publications\b/i;

const CONTACT = /\bemail\b|\bphone\b|\(\d{3}\)|\d{3}-\d{4}email|\b@[\w.-]+\.\w+/i;

const NEWS =
  /\b(department news|related news|pace perfect|host symposium|congrats)\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s+\d{1,2},\s+20\d{2}\b/i;

const AWARD = /\b(award|fellow|aaas|outstanding mentorship|nsf expeditions)\b/i;

const BIOGRAPHY =
  /\b(ph\.?d\.?|curriculum vitae|\bcv\b|he\/him|she\/her|teaching associate professor|technical director|interned at|returned to .{0,40} after serving|he is currently a professor|willett faculty scholar|co-director of|intro to ai class|edX|cum laude|bachelor|master'?s|campus affiliations|graduate council|board member|associate editor|editorial board|program chair|editor-in-chief|served as program director)\b/i;

const COURSE =
  /\b(INLS|CS|CSE|EECS|ECE)\s*\d{3}\b|\bcourses?\b.{0,20}\b(INLS|CS|CSE)\b|\bsyllabus\b|\blecture\b|\bexam\b/i;

const SCHOLAR_CHROME =
  /\b(try again later|add co-authors|co-authorsfollow|show more|the system can't perform|the ones marked may be different|articles 1,20|privacytermshelpabout scholar)\b/i;

const RESEARCH_SIGNAL =
  /\b(research interests?|lab (investigates|studies|works)|studies|investigates|proposes|focuses on|working on|current research|project|algorithm|method|framework|privacy-preserving|vulnerability|distributed|machine learning|information systems|database|security|natural language|computer vision|human-computer)\b/i;

const PUBLICATION_TITLE_HINT =
  /\b(proceedings of|ieee trans|acm trans|arxiv|nips|neurips|icml|iclr|emnlp|acl|soda|usenix|oakland|ccs |ndss|journal of)\b/i;

export function containsPageGarbage(text: string) {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value) return false;
  return (
    COURSE_SCHEDULE.test(value) ||
    ROOM_LOCATION.test(value) ||
    NAVIGATION.test(value) ||
    SCHOLAR_CHROME.test(value) ||
    /\bselected publications\b/i.test(value) ||
    /\b(tuth|mwf)\b/i.test(value)
  );
}

export function classifyTextBlock(text: string): PageTextClass {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value) return "UNKNOWN";
  if (COURSE_SCHEDULE.test(value) || ROOM_LOCATION.test(value)) {
    return COURSE_SCHEDULE.test(value) ? "COURSE_SCHEDULE" : "ROOM_LOCATION";
  }
  if (SCHOLAR_CHROME.test(value) || NAVIGATION.test(value)) return "NAVIGATION";
  if (
    /\b(technical director|teaching associate professor|associate editor|editorial board|currently a professor|willett faculty scholar|program director|interned at|intro to ai class)\b/i.test(
      value,
    )
  ) {
    return "BIOGRAPHY";
  }
  if (PAGE_HEADING.test(value) && value.split(/\s+/).length <= 6) return "PAGE_HEADING";
  if (CONTACT.test(value) && !RESEARCH_SIGNAL.test(value)) return "CONTACT_INFORMATION";
  if (NEWS.test(value)) return "NEWS";
  if (COURSE.test(value) && !PUBLICATION_TITLE_HINT.test(value)) return "COURSE";
  if (/suny |bits, india|campus affiliations|graduate council|vice-?chair|be \(hons\)/i.test(value)) return "BIOGRAPHY";
  if (BIOGRAPHY.test(value) && !RESEARCH_SIGNAL.test(value)) return "BIOGRAPHY";
  if (AWARD.test(value) && !RESEARCH_SIGNAL.test(value)) return "AWARD";
  if (PUBLICATION_TITLE_HINT.test(value) || looksLikePublicationTitle(value)) return "PUBLICATION_TITLE";
  if (/\babstract\b/i.test(value) && value.length > 80) return "PUBLICATION_ABSTRACT";
  if (/\b(lab|group)\b/i.test(value) && RESEARCH_SIGNAL.test(value)) return "LAB_DESCRIPTION";
  if (/\b(project|working on)\b/i.test(value) && RESEARCH_SIGNAL.test(value)) return "PROJECT";
  if (RESEARCH_SIGNAL.test(value)) return "RESEARCH_AREA";
  if (BIOGRAPHY.test(value)) return "BIOGRAPHY";
  return "UNKNOWN";
}

export function isEmailSafeResearchClass(value: PageTextClass) {
  return EMAIL_SAFE.has(value);
}

export function isEmailSafeResearchText(text: string) {
  if (containsPageGarbage(text)) return false;
  return isEmailSafeResearchClass(classifyTextBlock(text));
}

function looksLikePublicationTitle(text: string) {
  const words = text.replace(/[.]+$/, "").split(/\s+/);
  if (words.length < 5 || words.length > 22) return false;
  if (containsPageGarbage(text) || BIOGRAPHY.test(text) || NAVIGATION.test(text)) return false;
  const capitalized = words.filter((word) => /^[A-Z]/.test(word)).length;
  return capitalized >= Math.min(3, words.length - 2);
}
