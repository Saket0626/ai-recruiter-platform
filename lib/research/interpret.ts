import { containsPageGarbage, isEmailSafeResearchText } from "@/lib/research/page-classify";

export type VerifiedResearch = {
  broadArea: string;
  specificProblem: string;
  plainEnglish: string;
  recentProjectOrPaper: string | null;
  year: string | null;
  generationAllowed: boolean;
  rejectionReasons: string[];
};

const SKIP =
  /ignore (all )?previous|you are (chatgpt|an ai)|click here|accept cookies|enable javascript|privacy policy|terms of (use|service)|copyright \d{4}|all rights reserved|skip to (main )?content/i;

const BIO_DUMP =
  /suny |bits,|campus affiliations|graduate council|vice-?chair|electrical engineering,|computer science, suny|be \(hons\)|ph\.?d\.?|awards?|fellow|mentorship|he\/him|personal website|\bcurriculum\b|\bcv\b/i;

function normalize(text: string) {
  return text
    .replace(/[\u2014\u2013]/g, ",")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string) {
  const prepared = text.replace(
    /\s+(Education|Awards|Affiliations|Campus Affiliations|Personal Website|He\/Him(?:\/His)?|Selected Publications|Teaching|Courses)\s+/gi,
    ". ",
  );
  return prepared
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 24);
}

export function toLabWorkPhrase(raw: string) {
  let phrase = raw
    .replace(/["“”]/g, "")
    .replace(/^(the|this|our)\s+lab\s+(investigates|studies|researches|works on|focuses on|explores)\s+/i, "")
    .replace(/^dr\.\s+[\p{L}.'’-]+\s+(investigates|studies|researches|works on|focuses on|explores)\s+/iu, "")
    .replace(/^(he|she|they|we)\s+(investigates|studies|researches|works on|focuses on|explore[s]?)\s+/i, "")
    .replace(/^(his|her|their)\s+/i, "")
    .replace(/^(research interests? include|my research interests include|research interests are in the (broad )?area of)\s+/i, "")
    .replace(/^(research(ing)?|work)\s+on\s+/i, "")
    .replace(/^current (research )?includes?:\s+/i, "")
    .replace(/^current interests are in the area of\s+/i, "")
    .replace(/^at the same time,?\s+(as\s+)?/i, "")
    .replace(/^[\p{L}.'’-]+(?:\s+[\p{L}.'’-]+)?\s*'s research (addresses|interests lie in|focuses primarily on)\s+/iu, "")
    .replace(/[.!?]+$/g, "")
    .trim();
  if (phrase && !/^[A-Z0-9]{2,}(\s|$)/.test(phrase)) {
    phrase = phrase.charAt(0).toLowerCase() + phrase.slice(1);
  }
  const words = phrase.split(/\s+/).filter(Boolean);
  while (words.length && /^(the|of|in|and|at|for|to|a|an|on|with)$/i.test(words.at(-1) ?? "")) {
    words.pop();
  }
  if (words.length > 18) phrase = words.slice(0, 18).join(" ");
  else phrase = words.join(" ");
  return phrase.replace(/[,:]+$/g, "").trim();
}

function topicNeedles(topics: string[]) {
  const stop = new Set(["and", "the", "for", "with", "from", "into", "that", "this", "your"]);
  const out: string[] = [];
  for (const topic of topics) {
    const value = topic.toLowerCase().trim();
    if (value.length >= 4) out.push(value);
    for (const word of value.split(/[^a-z0-9]+/).filter((item) => item.length > 3 && !stop.has(item))) {
      out.push(word);
    }
  }
  return [...new Set(out)];
}

function scoreResearchSentence(sentence: string, needles: string[]) {
  if (SKIP.test(sentence) || BIO_DUMP.test(sentence) || containsPageGarbage(sentence) || !isEmailSafeResearchText(sentence)) {
    return -1;
  }
  const lower = sentence.toLowerCase();
  let score = 0;
  if (needles.some((needle) => lower.includes(needle))) score += 6;
  if (/\b(investigates|studies|proposes|focuses on|research interests|current research|lab)\b/i.test(sentence)) score += 8;
  if (/\b(proceedings|ieee trans|acm trans|arxiv|journal of)\b/i.test(sentence)) score += 5;
  const words = sentence.split(/\s+/).length;
  if (words < 6 || words > 40) score -= 3;
  if (words >= 8 && words <= 28) score += 2;
  return score;
}

export function interpretProfessorResearch(input: {
  topics: string[];
  evidenceTexts?: string[];
  researchSummary?: string;
}): VerifiedResearch {
  const topics = input.topics.filter(Boolean);
  const broadArea = topics[0] || "this research area";
  const evidence = (input.evidenceTexts ?? []).map(normalize).filter(Boolean);
  const combined = evidence.join(" ");
  const rejectionReasons: string[] = [];

  if (combined && containsPageGarbage(combined) && !splitSentences(combined).some((item) => isEmailSafeResearchText(item))) {
    rejectionReasons.push("retrieved page text is website chrome, not research");
  }

  const needles = topicNeedles(topics);
  let best: { phrase: string; sentence: string; score: number } | null = null;
  for (const sentence of splitSentences(combined)) {
    const score = scoreResearchSentence(sentence, needles);
    if (score < 0) continue;
    const phrase = toLabWorkPhrase(sentence);
    if (phrase.length < 18 || phrase.length > 160) continue;
    if (containsPageGarbage(phrase) || !isEmailSafeResearchText(sentence)) continue;
    if (!best || score > best.score) best = { phrase, sentence, score };
  }

  if (!best) {
    if (combined.length >= 24) {
      rejectionReasons.push("no email-safe research sentence was retrieved");
      return {
        broadArea,
        specificProblem: "",
        plainEnglish: "",
        recentProjectOrPaper: null,
        year: null,
        generationAllowed: false,
        rejectionReasons,
      };
    }
    const fallback = topics[0] || "";
    return {
      broadArea,
      specificProblem: fallback,
      plainEnglish: fallback ? `The professor's retrieved materials mention ${fallback}.` : "",
      recentProjectOrPaper: null,
      year: null,
      generationAllowed: Boolean(fallback),
      rejectionReasons: fallback ? [] : ["no research topics or evidence"],
    };
  }

  const year = best.sentence.match(/\b(202[4-6]|2023)\b/)?.[1] ?? null;
  return {
    broadArea,
    specificProblem: best.phrase,
    plainEnglish: `This professor works on ${best.phrase}.`,
    recentProjectOrPaper: /proceedings|ieee trans|acm trans|arxiv|journal of/i.test(best.sentence) ? best.phrase : null,
    year,
    generationAllowed: true,
    rejectionReasons: [],
  };
}

export function extractGroundedResearchDetail(input: {
  topics: string[];
  evidenceTexts: string[];
}): string | null {
  const research = interpretProfessorResearch(input);
  if (!research.generationAllowed || !research.specificProblem) return null;
  if ((input.evidenceTexts.join("").trim().length >= 24) && research.specificProblem === input.topics[0] && !input.evidenceTexts.join(" ").toLowerCase().includes(research.specificProblem.toLowerCase().slice(0, 18))) {
    return null;
  }
  return research.specificProblem;
}

export function draftUsesResearchDetail(body: string, detail: string) {
  const needle = detail.toLowerCase().slice(0, Math.min(detail.length, 28));
  return needle.length >= 16 && body.toLowerCase().includes(needle);
}
