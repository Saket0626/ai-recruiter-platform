import { getEnv, isSearchApiConfigured } from "@/lib/config/env";
import type { FacultySearchQuery, SearchProvider, SearchResult } from "@/lib/search/provider";
import { SeededCrawlerSearchProvider } from "@/lib/search/seeded-crawler";
import { WebSearchProvider } from "@/lib/search/web-search";
import { logger } from "@/lib/logging/logger";

export class CompositeSearchProvider implements SearchProvider {
  readonly name = "composite";

  constructor(private readonly seedUrls: string[]) {}

  async searchFaculty(query: FacultySearchQuery): Promise<SearchResult[]> {
    const seeded = new SeededCrawlerSearchProvider(this.seedUrls);
    const seededResults = await seeded.searchFaculty(query);
    if (!isSearchApiConfigured()) {
      logger.info("search_mode", { mode: "seeded-only", results: seededResults.length });
      return seededResults;
    }
    const web = new WebSearchProvider();
    const webResults = await web.searchFaculty(query);
    logger.info("search_mode", {
      mode: getEnv().SEARCH_PROVIDER,
      seeded: seededResults.length,
      web: webResults.length,
    });
    const merged = new Map<string, SearchResult>();
    for (const item of [...seededResults, ...webResults]) {
      if (!merged.has(item.url)) merged.set(item.url, item);
    }
    return [...merged.values()].slice(0, query.maxResults);
  }
}
