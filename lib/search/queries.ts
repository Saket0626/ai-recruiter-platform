import type { FacultySearchQuery } from "@/lib/search/provider";

export function buildFacultySearchQueries(input: {
  domain: string;
  keywords: string[];
  extra?: string[];
}) {
  const domain = input.domain.replace(/^www\./, "");
  const bases = input.keywords.length ? input.keywords : ["artificial intelligence", "machine learning", "software engineering", "cybersecurity"];
  const stems = ["professor", "faculty"];
  const queries: string[] = [];
  for (const keyword of bases.slice(0, 8)) {
    for (const stem of stems) {
      queries.push(`site:${domain} ${stem} ${keyword}`);
    }
  }
  queries.push(`site:${domain} faculty directory computer science`);
  queries.push(`site:${domain} people faculty`);
  for (const extra of input.extra ?? []) queries.push(extra);
  return [...new Set(queries)];
}

export function queriesForRun(query: FacultySearchQuery) {
  return buildFacultySearchQueries({
    domain: query.domain,
    keywords: query.keywords,
  });
}
