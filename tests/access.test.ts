import { describe, expect, it } from "vitest";
import { accessCookieValue, accessSecretsMatch, sameOriginOrMissing } from "@/lib/security/access";

describe("hosted access gate", () => {
  it("rejects secrets of unequal length without throwing", () => {
    expect(accessSecretsMatch("short", "much-longer-secret")).toBe(false);
  });

  it("accepts the matching secret", () => {
    expect(accessSecretsMatch("researchreach-gate", "researchreach-gate")).toBe(true);
  });

  it("binds the unlock cookie to the secret", () => {
    expect(accessCookieValue("abc")).toBe("rr1.abc");
  });

  it("allows same-origin mutating requests and missing Origin", () => {
    const same = new Request("https://web-production-3b016.up.railway.app/api/settings", {
      method: "POST",
      headers: {
        origin: "https://web-production-3b016.up.railway.app",
        host: "web-production-3b016.up.railway.app",
      },
    });
    expect(sameOriginOrMissing(same)).toBe(true);
    expect(sameOriginOrMissing(new Request("https://example.com/api/settings", { method: "POST" }))).toBe(true);
  });

  it("blocks a mismatched Origin", () => {
    const cross = new Request("https://web-production-3b016.up.railway.app/api/settings", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        host: "web-production-3b016.up.railway.app",
      },
    });
    expect(sameOriginOrMissing(cross)).toBe(false);
  });
});
