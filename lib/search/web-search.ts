import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";
import { USER_AGENT } from "@/lib/config/defaults";
import type { SearchProvider, SearchResult, FacultySearchQuery } from "@/lib/search/provider";
import { queriesForRun } from "@/lib/search/queries";

type TavilyResponse = { results?: Array<{ title?: string; url?: string; content?: string }> };
type BraveResponse = {
  web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
};

export class WebSearchProvider implements SearchProvider {
  readonly name = "web-search";

  async searchFaculty(query: FacultySearchQuery): Promise<SearchResult[]> {
    const env = getEnv();
    if (!env.SEARCH_API_KEY) return [];
    const searches = queriesForRun(query).slice(0, 6);
    const collected: SearchResult[] = [];
    for (const q of searches) {
      try {
        const batch =
          env.SEARCH_PROVIDER === "brave"
            ? await this.brave(q, env.SEARCH_API_KEY)
            : await this.tavily(q, env.SEARCH_API_KEY, env.SEARCH_API_URL);
        collected.push(...batch);
      } catch (error) {
        logger.warn("search_query_failed", {
          provider: env.SEARCH_PROVIDER,
          query: q,
          error: error instanceof Error ? error.message : "search failed",
        });
      }
    }
    const unique = new Map<string, SearchResult>();
    for (const item of collected) {
      if (!unique.has(item.url)) unique.set(item.url, item);
    }
    return [...unique.values()].slice(0, query.maxResults);
  }

  private async tavily(query: string, apiKey: string, apiUrl?: string): Promise<SearchResult[]> {
    const endpoint = apiUrl || "https://api.tavily.com/search";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, max_results: 8, search_depth: "basic" }),
    });
    if (!response.ok) throw new Error(`Tavily HTTP ${response.status}`);
    const data = (await response.json()) as TavilyResponse;
    return (data.results ?? []).map((result) => ({
      title: result.title ?? "",
      url: result.url ?? "",
      snippet: result.content ?? "",
    })).filter((result) => result.url);
  }

  private async brave(query: string, apiKey: string): Promise<SearchResult[]> {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "8");
    const response = await fetch(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    });
    if (!response.ok) throw new Error(`Brave HTTP ${response.status}`);
    const data = (await response.json()) as BraveResponse;
    return (data.web?.results ?? []).map((result) => ({
      title: result.title ?? "",
      url: result.url ?? "",
      snippet: result.description ?? "",
    })).filter((result) => result.url);
  }
}
