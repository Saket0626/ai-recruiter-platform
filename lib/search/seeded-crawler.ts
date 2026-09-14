import { getEnv } from "@/lib/config/env";
import { extractFacultyFromDirectory, extractVisibleText } from "@/lib/research/parser";
import { fetchPublicHtml } from "@/lib/search/fetch-public";
import { isUrlAllowedByRobots } from "@/lib/search/robots";
import type { FacultySearchQuery, SearchProvider, SearchResult } from "@/lib/search/provider";
import { normalizeUrl } from "@/lib/security/email";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { fetchPublicHtml };

export class SeededCrawlerSearchProvider implements SearchProvider {
  readonly name = "seeded-crawler";

  constructor(private readonly seedUrls: string[]) {}

  async searchFaculty(query: FacultySearchQuery): Promise<SearchResult[]> {
    const delay = getEnv().CRAWL_DELAY_MS;
    const results: SearchResult[] = [];
    const seen = new Set<string>();
    for (const seed of this.seedUrls) {
      const normalized = normalizeUrl(seed);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      const allowed = await isUrlAllowedByRobots(normalized);
      if (!allowed) continue;
      await sleep(delay);
      const page = await fetchPublicHtml(normalized);
      if (!page.ok) continue;
      const faculty = extractFacultyFromDirectory(page.html, page.url, query.domain);
      if (faculty.length) {
        for (const person of faculty) {
          results.push({
            title: person.fullName,
            url: person.facultyPageUrl || page.url,
            snippet: person.snippet,
          });
        }
      } else {
        results.push({
          title: extractVisibleText(page.html).slice(0, 80),
          url: page.url,
          snippet: extractVisibleText(page.html).slice(0, 280),
        });
      }
      if (results.length >= query.maxResults) break;
    }
    return results.slice(0, query.maxResults);
  }
}
