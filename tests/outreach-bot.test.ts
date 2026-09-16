import { describe, expect, it } from "vitest";
import { hasPublishedResearch, publicationLinks, primaryResearchLink } from "@/lib/research/publications";
import { formatOutreachPackage, outreachPackageFromDraft } from "@/lib/bot/packages";
import { isSaketRelevantResearch } from "@/lib/research/keywords";

describe("publication evidence", () => {
  it("requires retrieved publication clues, not invented paper titles", () => {
    expect(
      hasPublishedResearch("Selected publications include work in the Proceedings of NeurIPS 2024."),
    ).toBe(true);
    expect(hasPublishedResearch("Google Scholar profile and recent publications are listed below.")).toBe(true);
    expect(hasPublishedResearch("Office hours are Tuesday at 2pm in the CS building.")).toBe(false);
    expect(hasPublishedResearch("Faculty profile", ["https://scholar.google.com/citations?user=abc"])).toBe(true);
  });

  it("picks scholar or publication URLs from retrieved links", () => {
    const links = publicationLinks([
      "https://cs.utdallas.edu/people/faculty/hamlen/",
      "https://scholar.google.com/citations?user=abc",
      "javascript:void(0)",
    ]);
    expect(links[0]).toContain("scholar.google.com");
    expect(primaryResearchLink(links)).toContain("scholar.google.com");
  });
});

describe("Saket-relevant research", () => {
  it("accepts AI, software engineering, and information systems pages", () => {
    expect(isSaketRelevantResearch("Research in large language models and machine learning.")).toBe(true);
    expect(isSaketRelevantResearch("The lab studies software engineering and program analysis.")).toBe(true);
    expect(isSaketRelevantResearch("Work on information systems in organizations.")).toBe(true);
    expect(isSaketRelevantResearch("This page lists parking and campus maps.")).toBe(false);
  });
});

describe("outreach package", () => {
  it("prints professor email, research link, college, header, body, and resume path", () => {
    const pkg = outreachPackageFromDraft({
      professorName: "Kevin Hamlen",
      college: "The University of Texas at Dallas",
      professorEmail: "hamlen@utdallas.edu",
      evidenceUrls: ["https://personal.utdallas.edu/~hamlen/"],
      facultyPageUrl: "https://cs.utdallas.edu/people/faculty/hamlen/",
      subject: "Undergraduate Research Interest in Software Security",
      body: "Hello Dr. Hamlen,\n\nMy name is Saket.",
      resumePath: "data/resume.pdf",
    });
    expect(pkg).not.toBeNull();
    const text = formatOutreachPackage(pkg!);
    expect(text).toContain("College: The University of Texas at Dallas");
    expect(text).toContain("Professor email: hamlen@utdallas.edu");
    expect(text).toContain("Research link:");
    expect(text).toContain("Email header:");
    expect(text).toContain("Undergraduate Research Interest in Software Security");
    expect(text).toContain("Resume attached: data/resume.pdf");
    expect(text).toContain("Hello Dr. Hamlen");
  });

  it("does not build a package without a professor email", () => {
    expect(
      outreachPackageFromDraft({
        professorName: "Unknown",
        college: "MIT",
        professorEmail: null,
        evidenceUrls: ["https://example.edu/p"],
        subject: "Hello",
        body: "Hello",
        resumePath: "data/resume.pdf",
      }),
    ).toBeNull();
  });
});
