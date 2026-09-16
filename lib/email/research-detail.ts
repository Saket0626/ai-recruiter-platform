const SKIP =
  /ignore (all )?previous|you are (chatgpt|an ai)|click here|accept cookies|enable javascript|privacy policy|terms of (use|service)|copyright \d{4}|all rights reserved|skip to (main )?content|honors and awards|meritorious service|additional information|search menu|secondary navigation/i;

const BIOGRAPHY =
  /education|ph\.?d\.?|awards?|fellow|affiliation|vice-?chair|bachelor|master'?s|\bhonou?rs?\b|\bbe\s*\(|campus affiliations|senate|mentorship|distinguished professor|he\/him|she\/her|they\/them|personal website|\bcurriculum\b|\bcv\b|@[\w.-]+\.\w+|\(\d{3}\)|\b20\d{2}-\d{2}\b|\b19\d{2}\b|suny |bits,|alexandria university|graduate council|outstanding mentorship|electrical engineering,|computer science, suny|bits, india|board member|endowment|served as|program chair|editor-in-chief/i;

const RESEARCHY =
  /research|lab|stud(y|ies)|security|privacy|system|model|learn|algorithm|analysis|network|data|software|information|economic|attack|defense|program|language|vision|database|comput|method|framework|protocol|organization|technology/i;

function normalize(text: string) {
  return text
    .replace(/[\u2014\u2013]/g, ",")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string) {
  const prepared = text.replace(
    /\s+(Education|Awards|Affiliations|Campus Affiliations|Personal Website|He\/Him(?:\/His)?)\s+/gi,
    ". ",
  );
  const parts = prepared
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 20);
  return parts.length ? parts : text.trim() ? [text.trim()] : [];
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

export function toLabWorkPhrase(raw: string) {
  let phrase = raw
    .replace(/["“”]/g, "")
    .replace(/^(the|this|our)\s+lab\s+(investigates|studies|researches|works on|focuses on|explores)\s+/i, "")
    .replace(/^dr\.\s+\w+\s+(investigates|studies|researches|works on|focuses on|explores)\s+/i, "")
    .replace(/^(he|she|they|we)\s+(investigates|studies|researches|works on|focuses on|explore[s]?)\s+/i, "")
    .replace(/^(his|her|their)\s+/i, "")
    .replace(/^(research(ing)?|work)\s+on\s+/i, "")
    .replace(/^current interests are in the area of\s+/i, "")
    .replace(/^at the same time,?\s+(as\s+)?/i, "")
    .replace(/^[\p{L}.'’-]+(?:\s+[\p{L}.'’-]+)?\s*'s research addresses\s+/iu, "")
    .replace(/[.!?]+$/g, "")
    .trim();
  if (phrase && !/^[A-Z0-9]{2,}(\s|$)/.test(phrase)) {
    phrase = phrase.charAt(0).toLowerCase() + phrase.slice(1);
  }
  const words = phrase.split(/\s+/).filter(Boolean);
  while (words.length && /^(the|of|in|and|at|for|to|a|an|on)$/i.test(words.at(-1) ?? "")) {
    words.pop();
  }
  if (words.length > 14) phrase = words.slice(0, 14).join(" ");
  else phrase = words.join(" ");
  const trimmedWords = phrase.split(/\s+/).filter(Boolean);
  while (trimmedWords.length && /^(the|of|in|and|at|for|to|a|an|on)$/i.test(trimmedWords.at(-1) ?? "")) {
    trimmedWords.pop();
  }
  phrase = trimmedWords.join(" ");
  return phrase.replace(/[,:]+$/g, "").trim();
}

function leftoverResearchWords(sentence: string, topics: string[]) {
  let remaining = sentence.toLowerCase();
  for (const topic of [...topics].sort((a, b) => b.length - a.length)) {
    remaining = remaining.replaceAll(topic.toLowerCase(), " ");
  }
  const generic = new Set([
    "work",
    "also",
    "covers",
    "studies",
    "about",
    "their",
    "this",
    "used",
    "using",
    "from",
    "with",
    "into",
    "than",
    "have",
    "been",
    "lab",
    "investigates",
  ]);
  return remaining
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !generic.has(word));
}

function scoreCandidate(sentence: string, topics: string[], needles: string[]) {
  const lower = sentence.toLowerCase();
  if (SKIP.test(sentence) || BIOGRAPHY.test(sentence)) return -1;
  if (/fundamental problems facing us/i.test(sentence)) return -1;
  if ((sentence.match(/,/g) ?? []).length >= 3) return -1;
  const leftover = leftoverResearchWords(sentence, topics);
  const topicHit = needles.some((needle) => lower.includes(needle));
  if (!RESEARCHY.test(sentence) && !topicHit && leftover.length === 0) return -1;
  if (!RESEARCHY.test(sentence) && !topicHit) return -1;
  let score = leftover.length * 4;
  if (topicHit) score += 2;
  if (leftover.length === 0) score -= 6;
  const words = sentence.split(/\s+/).length;
  if (words < 6 || words > 32) score -= 2;
  if (words >= 8 && words <= 22) score += 1;
  return score;
}

export function extractGroundedResearchDetail(input: {
  topics: string[];
  evidenceTexts: string[];
}): string | null {
  const combined = normalize(input.evidenceTexts.filter(Boolean).join(" "));
  if (combined.length < 24) return null;
  const needles = topicNeedles(input.topics);
  const candidates = splitSentences(combined);

  let best: { phrase: string; score: number } | null = null;
  for (const sentence of candidates) {
    const score = scoreCandidate(sentence, input.topics, needles);
    if (score < 0) continue;
    const phrase = toLabWorkPhrase(sentence);
    if (phrase.length < 20 || phrase.length > 140) continue;
    if (SKIP.test(phrase) || BIOGRAPHY.test(phrase)) continue;
    if ((phrase.match(/,/g) ?? []).length >= 3) continue;
    if (!best || score > best.score) best = { phrase, score };
  }
  if (best) return best.phrase;

  const lower = combined.toLowerCase();
  for (const needle of needles) {
    const idx = lower.indexOf(needle);
    if (idx < 0) continue;
    const start = Math.max(0, combined.lastIndexOf(" ", Math.max(0, idx - 50)) + 1);
    const endAt = combined.indexOf(" ", idx + needle.length + 70);
    const window = combined.slice(start, endAt < 0 ? idx + needle.length + 70 : endAt);
    const phrase = toLabWorkPhrase(window);
    if (phrase.length >= 20 && phrase.length <= 140 && !BIOGRAPHY.test(phrase) && (phrase.match(/,/g) ?? []).length < 3) {
      return phrase;
    }
  }
  return null;
}

export function draftUsesResearchDetail(body: string, detail: string) {
  const needle = detail.toLowerCase().slice(0, Math.min(detail.length, 28));
  return needle.length >= 16 && body.toLowerCase().includes(needle);
}
