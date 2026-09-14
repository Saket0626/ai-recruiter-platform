import { USER_AGENT } from "@/lib/config/defaults";
import { logger } from "@/lib/logging/logger";
import { assertPublicHttpUrl, type DnsLookup, UnsafeUrlError } from "@/lib/search/ssrf";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 20_000;

export type FetchPublicDeps = {
  lookup?: DnsLookup;
  fetch?: typeof fetch;
};

function redirectUrl(current: URL, location: string | null) {
  if (!location) return null;
  try {
    return new URL(location, current);
  } catch {
    return null;
  }
}

export async function fetchPublicHtml(
  url: string,
  deps: FetchPublicDeps = {},
): Promise<{ ok: boolean; url: string; html: string; status: number }> {
  const fetchImpl = deps.fetch ?? fetch;
  try {
    let current = await assertPublicHttpUrl(url, deps);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response = await fetchImpl(current.href, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain" },
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = redirectUrl(current, response.headers.get("location"));
        if (!next) {
          return { ok: false, url: current.href, html: "", status: response.status };
        }
        current = await assertPublicHttpUrl(next.href, deps);
        continue;
      }
      const raw = await response.arrayBuffer();
      const sliced = raw.byteLength > MAX_BYTES ? raw.slice(0, MAX_BYTES) : raw;
      const html = new TextDecoder("utf-8", { fatal: false }).decode(sliced);
      if (!response.ok) {
        return { ok: false, url: current.href, html: "", status: response.status };
      }
      return { ok: true, url: current.href, html, status: response.status };
    }
    logger.warn("crawl_too_many_redirects", { url });
    return { ok: false, url, html: "", status: 0 };
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      logger.warn("crawl_ssrf_blocked", { url, error: error.message });
      return { ok: false, url, html: "", status: 0 };
    }
    logger.warn("crawl_fetch_failed", { url, error: error instanceof Error ? error.message : "fetch failed" });
    return { ok: false, url, html: "", status: 0 };
  }
}
