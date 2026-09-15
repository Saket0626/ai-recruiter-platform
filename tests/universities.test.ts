import { describe, expect, it } from "vitest";
import {
  UNIVERSITIES,
  findUniversity,
  getTop100Universities,
  getTopCsUniversities,
  searchUniversities,
  resolveUniversitySelection,
  resolveUniversitySelections,
} from "@/lib/universities/catalog";
import { buildFacultySearchQueries } from "@/lib/search/queries";

describe("university catalog", () => {
  it("contains at least 100 U.S. universities", () => {
    expect(UNIVERSITIES.length).toBeGreaterThanOrEqual(100);
  });

  it("marks at least 100 national universities as the Top 100 preset", () => {
    const top = getTop100Universities();
    expect(top.length).toBeGreaterThanOrEqual(100);
    const domains = new Set(top.map((university) => university.domain));
    expect(domains.size).toBeGreaterThanOrEqual(100);
    expect(domains.has("mit.edu")).toBe(true);
    expect(domains.has("stanford.edu")).toBe(true);
    expect(domains.has("harvard.edu")).toBe(true);
    expect(domains.has("cmu.edu")).toBe(true);
    expect(domains.has("berkeley.edu")).toBe(true);
    expect(domains.has("gatech.edu")).toBe(true);
    expect(domains.has("utexas.edu")).toBe(true);
    expect(domains.has("umich.edu")).toBe(true);
    expect(top.every((university) => university.inTop100)).toBe(true);
  });

  it("includes UTD as a selectable school without making it the only research target", () => {
    const names = UNIVERSITIES.map((university) => `${university.name} ${university.shortName} ${university.aliases.join(" ")}`);
    for (const needle of ["Dallas", "MIT", "Stanford", "Harvard", "CMU", "Berkeley", "Georgia Tech", "UIUC", "Michigan", "Baylor", "TCU"]) {
      expect(names.some((name) => name.includes(needle))).toBe(true);
    }
    expect(UNIVERSITIES.filter((university) => university.domain !== "utdallas.edu").length).toBeGreaterThanOrEqual(100);
  });

  it("finds universities by alias and domain", () => {
    expect(findUniversity("UTD")?.domain).toBe("utdallas.edu");
    expect(findUniversity("mit.edu")?.shortName).toBe("MIT");
    expect(searchUniversities("stanford")[0]?.domain).toBe("stanford.edu");
  });

  it("builds site: queries for the selected university, not a hardcoded UTD domain", () => {
    const mit = resolveUniversitySelection({ university: "MIT" });
    const queries = buildFacultySearchQueries({ domain: mit.domain, keywords: ["machine learning"] });
    expect(mit.domain).toBe("mit.edu");
    expect(queries.some((query) => query.includes("site:mit.edu"))).toBe(true);
    expect(queries.every((query) => !query.includes("site:utdallas.edu"))).toBe(true);
  });

  it("keeps UTD as a selectable default with faculty seeds", () => {
    const utd = resolveUniversitySelection({});
    expect(utd.domain).toBe("utdallas.edu");
    expect(utd.seedUrls.length).toBeGreaterThan(0);
  });

  it("resolves a Top 100 preset to many schools instead of only UTD", () => {
    const selected = resolveUniversitySelections({ preset: "top100" });
    expect(selected.length).toBeGreaterThanOrEqual(100);
    expect(selected.some((university) => university.domain === "mit.edu")).toBe(true);
    expect(selected.some((university) => university.domain === "stanford.edu")).toBe(true);
    expect(selected.filter((university) => university.domain === "utdallas.edu")).toHaveLength(0);
  });

  it("resolves multiple named universities in one discovery selection", () => {
    const selected = resolveUniversitySelections({
      universities: ["MIT", "Stanford University", "University of Michigan", "Georgia Tech"],
    });
    expect(selected.map((university) => university.domain).sort()).toEqual(
      ["gatech.edu", "mit.edu", "stanford.edu", "umich.edu"].sort(),
    );
  });

  it("includes UTD in the top CS preset alongside national CS programs", () => {
    const selected = getTopCsUniversities();
    expect(selected.some((university) => university.domain === "utdallas.edu")).toBe(true);
    expect(selected.some((university) => university.domain === "cmu.edu")).toBe(true);
    expect(selected.length).toBeGreaterThan(10);
  });
});
