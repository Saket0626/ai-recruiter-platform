/** Distinctive LLM/filler terms. Do not ban words the Saket template itself uses (it, that, can, able). */
export const BANNED_STYLE_TERMS = [
  "delve",
  "embark",
  "enlightening",
  "esteemed",
  "shed light",
  "crafting",
  "game-changer",
  "unlock",
  "skyrocket",
  "skyrocketing",
  "abyss",
  "not alone",
  "in a world where",
  "revolutionize",
  "disruptive",
  "utilize",
  "utilizing",
  "dive deep",
  "tapestry",
  "illuminate",
  "unveil",
  "pivotal",
  "intricate",
  "elucidate",
  "furthermore",
  "moreover",
  "hence",
  "harness",
  "exciting",
  "groundbreaking",
  "cutting-edge",
  "remarkable",
  "glimpse into",
  "navigating",
  "landscape",
  "testament",
  "in summary",
  "in conclusion",
  "in closing",
  "ever-evolving",
  "remains to be seen",
  "however",
];

export function sanitizeGeneratedText(text: string) {
  return text
    .replace(/[\u2014\u2013]/g, ", ")
    .replace(/;/g, ".")
    .replace(/[*_`#]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

export function styleFailures(text: string): Array<{ code: string; message: string }> {
  const failures: Array<{ code: string; message: string }> = [];
  if (/[\u2014\u2013]/.test(text)) {
    failures.push({ code: "em_dash", message: "Email contains an em dash or en dash." });
  }
  if (text.includes(";")) {
    failures.push({ code: "semicolon", message: "Email contains a semicolon." });
  }
  if (/[*_`]/.test(text) || /(^|\n)\s*#/.test(text) || /(?:^|\s)#[A-Za-z]/.test(text)) {
    failures.push({ code: "markdown", message: "Email contains markdown, asterisks, or hashtags." });
  }
  if (/not just .{2,80} but also/i.test(text)) {
    failures.push({ code: "setup_language", message: "Email uses a banned not-just-but-also construction." });
  }
  const lower = text.toLowerCase();
  for (const term of BANNED_STYLE_TERMS) {
    const found = term.includes(" ")
      ? lower.includes(term)
      : new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
    if (found) {
      failures.push({ code: "llm_phrase", message: `Email contains a banned style term: ${term}.` });
      break;
    }
  }
  return failures;
}
