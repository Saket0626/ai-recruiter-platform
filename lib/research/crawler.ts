import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";
import { fetchPublicHtml } from "@/lib/search/seeded-crawler";
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

export class PlaywrightResearchProvider implements ProfessorResearchProvider {
  async retrieve(urls: string[]): Promise<RetrievedPage[]> {
    if (!getEnv().PLAYWRIGHT_ENABLED) return [];
    try {
      const moduleName = "playwright";
      const playwright = (await import(moduleName)) as {
        chromium: { launch: (opts: { headless: boolean }) => Promise<{
          newPage: (opts: { userAgent: string }) => Promise<{
            goto: (url: string, opts: { waitUntil: string; timeout: number }) => Promise<void>;
            content: () => Promise<string>;
            title: () => Promise<string>;
            close: () => Promise<void>;
          }>;
          close: () => Promise<void>;
        }> };
      };
      const browser = await playwright.chromium.launch({ headless: true });
      const pages: RetrievedPage[] = [];
      for (const url of urls) {
        const page = await browser.newPage({ userAgent: "ResearchReach/1.0" });
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        const html = await page.content();
        pages.push({
          url,
          title: await page.title(),
          text: extractVisibleText(html),
          html,
        });
        await page.close();
      }
      await browser.close();
      return pages;
    } catch (error) {
      logger.warn("playwright_unavailable", {
        error: error instanceof Error ? error.message : "playwright failed",
      });
      return [];
    }
  }
}

export class FallbackResearchProvider implements ProfessorResearchProvider {
  constructor(
    private readonly primary: ProfessorResearchProvider = new CheerioResearchProvider(),
    private readonly fallback: ProfessorResearchProvider = new PlaywrightResearchProvider(),
  ) {}

  async retrieve(urls: string[]): Promise<RetrievedPage[]> {
    const pages = await this.primary.retrieve(urls);
    const thin = pages.filter((page) => page.text.length < 180).map((page) => page.url);
    if (!thin.length || !getEnv().PLAYWRIGHT_ENABLED) return pages;
    const rendered = await this.fallback.retrieve(thin);
    const byUrl = new Map(pages.map((page) => [page.url, page]));
    for (const page of rendered) byUrl.set(page.url, page);
    return [...byUrl.values()];
  }
}
