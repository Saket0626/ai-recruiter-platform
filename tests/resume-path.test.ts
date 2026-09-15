import { describe, expect, it } from "vitest";
import { resumeSearchPaths } from "@/lib/resume/paths";

describe("resume path candidates", () => {
  it("always includes data/resume.pdf and the Railway volume path", () => {
    const paths = resumeSearchPaths();
    expect(paths.some((item) => item.endsWith("data/resume.pdf") || item.includes("/data/resume.pdf"))).toBe(true);
    expect(paths).toContain("/app/resume-data/resume.pdf");
  });
});
