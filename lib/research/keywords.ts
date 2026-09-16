export type TopicFamily = "ai" | "systems" | "other";

export type KeywordFamily = {
  id: string;
  family: TopicFamily;
  label: string;
  terms: string[];
};

export const KEYWORD_FAMILIES: KeywordFamily[] = [
  {
    id: "ai",
    family: "ai",
    label: "artificial intelligence",
    terms: [
      "artificial intelligence",
      "machine intelligence",
      "computational intelligence",
      "intelligent systems",
      "ai research",
    ],
  },
  {
    id: "ml",
    family: "ai",
    label: "machine learning",
    terms: ["machine learning", "statistical learning", "supervised learning", "unsupervised learning"],
  },
  {
    id: "llm",
    family: "ai",
    label: "large language models",
    terms: [
      "large language model",
      "large language models",
      "foundation model",
      "foundation models",
      "generative ai",
      "llm",
      "llms",
    ],
  },
  {
    id: "nlp",
    family: "ai",
    label: "natural language processing",
    terms: ["natural language processing", "computational linguistics", "text mining", "nlp"],
  },
  {
    id: "cv",
    family: "ai",
    label: "computer vision",
    terms: ["computer vision", "image recognition", "visual computing", "visual learning"],
  },
  {
    id: "agents",
    family: "ai",
    label: "AI agents",
    terms: ["ai agent", "ai agents", "autonomous agent", "multi-agent", "agentic"],
  },
  {
    id: "dl",
    family: "ai",
    label: "deep learning",
    terms: ["deep learning", "neural network", "neural networks", "representation learning"],
  },
  {
    id: "ds",
    family: "ai",
    label: "data science",
    terms: ["data science", "data mining", "predictive analytics", "big data"],
  },
  {
    id: "se",
    family: "systems",
    label: "software engineering",
    terms: ["software engineering", "software systems", "software development", "empirical software"],
  },
  {
    id: "pa",
    family: "systems",
    label: "program analysis",
    terms: [
      "program analysis",
      "static analysis",
      "dynamic analysis",
      "software verification",
      "formal methods",
      "symbolic execution",
    ],
  },
  {
    id: "pl",
    family: "systems",
    label: "programming languages",
    terms: ["programming language", "programming languages", "compilers", "type systems"],
  },
  {
    id: "sec",
    family: "systems",
    label: "cybersecurity",
    terms: [
      "cybersecurity",
      "computer security",
      "software security",
      "information security",
      "network security",
      "malware",
      "vulnerability",
    ],
  },
  {
    id: "privacy",
    family: "systems",
    label: "privacy",
    terms: ["privacy", "data privacy", "differential privacy", "usable privacy"],
  },
  {
    id: "dist",
    family: "systems",
    label: "distributed systems",
    terms: ["distributed systems", "distributed computing", "cloud computing", "operating systems"],
  },
  {
    id: "net",
    family: "systems",
    label: "computer networks",
    terms: ["computer networks", "networking", "wireless networks", "internet measurement"],
  },
  {
    id: "db",
    family: "systems",
    label: "databases",
    terms: ["database", "databases", "data management", "query processing"],
  },
  {
    id: "hci",
    family: "systems",
    label: "human-computer interaction",
    terms: ["human-computer interaction", "human computer interaction", "hci", "usable security"],
  },
  {
    id: "is",
    family: "systems",
    label: "information systems",
    terms: [
      "information systems",
      "information security and privacy",
      "economics of technology",
      "mis ",
      "it management",
    ],
  },
];

export function normalizeText(text: string) {
  return text.toLowerCase().replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ");
}

export function findKeywordMatches(text: string) {
  const haystack = normalizeText(text);
  const matches: Array<{ id: string; family: TopicFamily; label: string; term: string }> = [];
  for (const group of KEYWORD_FAMILIES) {
    for (const term of group.terms) {
      if (haystack.includes(term.toLowerCase())) {
        matches.push({ id: group.id, family: group.family, label: group.label, term });
        break;
      }
    }
  }
  return matches;
}

export function uniqueLabels(matches: Array<{ label: string }>) {
  return [...new Set(matches.map((match) => match.label))];
}

export function hasAiResearch(text: string) {
  return findKeywordMatches(text).some((match) => match.family === "ai");
}

export function aiTopicLabels(text: string) {
  return uniqueLabels(findKeywordMatches(text).filter((match) => match.family === "ai"));
}

const SAKET_FAMILY_IDS = new Set(["ai", "ml", "llm", "nlp", "cv", "agents", "dl", "ds", "se", "is", "pa", "hci", "db"]);

export function saketTopicLabels(text: string) {
  return uniqueLabels(
    findKeywordMatches(text).filter((match) => match.family === "ai" || SAKET_FAMILY_IDS.has(match.id)),
  );
}

export function isSaketRelevantResearch(text: string) {
  return saketTopicLabels(text).length > 0;
}

export function topicSupportedByEvidence(topic: string, evidence: string) {
  const haystack = normalizeText(evidence);
  const needle = topic.toLowerCase().trim();
  if (!needle) return false;
  if (haystack.includes(needle.slice(0, Math.min(18, needle.length)))) return true;
  const family = KEYWORD_FAMILIES.find((group) => group.label.toLowerCase() === needle);
  if (!family) return false;
  return family.terms.some((term) => haystack.includes(term.toLowerCase()));
}
