import { describe, expect, it, afterEach } from "vitest";
import { publicOrigin } from "@/lib/http/public-origin";

describe("publicOrigin", () => {
  afterEach(() => {
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  it("uses forwarded Railway host instead of 0.0.0.0", () => {
    const request = new Request("http://0.0.0.0:8080/api/auth/google/callback?connected=1", {
      headers: {
        "x-forwarded-host": "web-production-3b016.up.railway.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(publicOrigin(request)).toBe("https://web-production-3b016.up.railway.app");
  });

  it("falls back to GOOGLE_REDIRECT_URI when the listen address is a bind host", () => {
    process.env.GOOGLE_REDIRECT_URI = "https://web-production-3b016.up.railway.app/api/auth/google/callback";
    const request = new Request("http://0.0.0.0:8080/api/auth/google/callback");
    expect(publicOrigin(request)).toBe("https://web-production-3b016.up.railway.app");
  });

  it("keeps localhost for local development", () => {
    const request = new Request("http://localhost:3000/api/auth/google/callback");
    expect(publicOrigin(request)).toBe("http://localhost:3000");
  });
});
