import { fetchPublicHtml } from "@/lib/search/fetch-public";
import { isUrlAllowedByRobots } from "@/lib/search/robots";
import { extractPageTitle, extractVisibleText } from "@/lib/research/parser";
import { getCachedPage, putCachedPage, crawlDelay } from "@/lib/research/page-cache";
import type { ProfessorResearchProvider, RetrievedPage } from "@/lib/research/provider";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CheerioResearchProvider implements ProfessorResearchProvider {
  async retrieve(urls: string[]): Promise<RetrievedPage[]> {
    const pages: RetrievedPage[] = [];
    for (const url of urls) {
      const allowed = await isUrlAllowedByRobots(url);
      if (!allowed) continue;
      const cached = await getCachedPage(url);
      if (cached) {
        pages.push({
          url,
          title: extractPageTitle(cached.body),
          text: extractVisibleText(cached.body),
          html: cached.body,
        });
        continue;
      }
      await sleep(crawlDelay());
      const fetched = await fetchPublicHtml(url);
      await putCachedPage({ url, body: fetched.html, statusCode: fetched.status });
      if (!fetched.ok) continue;
      pages.push({
        url: fetched.url,
        title: extractPageTitle(fetched.html),
        text: extractVisibleText(fetched.html),
        html: fetched.html,
      });
    }
    return pages;
  }
}

/** HTML crawl only. Playwright is not a dependency and is not advertised. */
export class FallbackResearchProvider extends CheerioResearchProvider {}
