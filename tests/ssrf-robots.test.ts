import { describe, expect, it, vi } from "vitest";
import { fetchPublicHtml } from "@/lib/search/fetch-public";
import { isBlockedIp, UnsafeUrlError, assertPublicHttpUrl } from "@/lib/search/ssrf";
import { parseRobotsTxt, pathAllowedByRobots } from "@/lib/search/robots";
import { USER_AGENT } from "@/lib/config/defaults";

describe("SSRF defenses", () => {
  it("rejects loopback and metadata IP literals before any request", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch should not run for blocked addresses");
    });
    const loopback = await fetchPublicHtml("http://127.0.0.1/secret", { fetch: fetchImpl });
    const metadata = await fetchPublicHtml("http://169.254.169.254/latest/meta-data", { fetch: fetchImpl });
    expect(loopback.ok).toBe(false);
    expect(metadata.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("169.254.169.254")).toBe(true);
    expect(isBlockedIp("8.8.8.8")).toBe(false);
  });

  it("rejects a seed hostname that resolves to 127.0.0.1 before fetch", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch should not run after private DNS");
    });
    const lookup = vi.fn(async () => [{ address: "127.0.0.1", family: 4 }]);
    const result = await fetchPublicHtml("https://faculty.example.edu/people", { fetch: fetchImpl, lookup });
    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(assertPublicHttpUrl("https://faculty.example.edu/people", { lookup })).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });

  it("re-checks redirect hops and blocks a redirect to a private address", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const href = String(input);
      if (href.includes("faculty.example.edu")) {
        return new Response(null, {
          status: 302,
          headers: { Location: "http://169.254.169.254/latest/meta-data" },
        });
      }
      throw new Error(`unexpected fetch ${href}`);
    });
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
    const result = await fetchPublicHtml("https://faculty.example.edu/people", { fetch: fetchImpl, lookup });
    expect(result.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("robots.txt parsing", () => {
  it("skips paths disallowed for ResearchReach", () => {
    const text = `
User-agent: ResearchReach
Disallow: /faculty
Allow: /faculty/public

User-agent: *
Disallow: /
`;
    expect(pathAllowedByRobots("/faculty/secret", text, USER_AGENT)).toBe(false);
    expect(pathAllowedByRobots("/faculty/public/bio", text, USER_AGENT)).toBe(true);
    expect(parseRobotsTxt(text).length).toBeGreaterThan(0);
  });
});
