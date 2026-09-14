import { USER_AGENT } from "@/lib/config/defaults";
import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";
import { extractFacultyFromDirectory, extractVisibleText } from "@/lib/research/parser";
import type { FacultySearchQuery, SearchProvider, SearchResult } from "@/lib/search/provider";
import { normalizeUrl } from "@/lib/security/email";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchPublicHtml(url: string): Promise<{ ok: boolean; url: string; html: string; status: number }> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    const html = await response.text();
    if (!response.ok) {
      return { ok: false, url, html: "", status: response.status };
    }
    return { ok: true, url: response.url || url, html, status: response.status };
  } catch (error) {
    logger.warn("crawl_fetch_failed", { url, error: error instanceof Error ? error.message : "fetch failed" });
    return { ok: false, url, html: "", status: 0 };
  }
}

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
