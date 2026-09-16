import { describe, expect, it } from "vitest";
import { hasPublishedResearch, publicationLinks, primaryResearchLink } from "@/lib/research/publications";
import { formatOutreachPackage, outreachPackageFromDraft } from "@/lib/bot/packages";
import { filterNewPackages, parseSeenFromDocText } from "@/lib/bot/ledger";
import { pickNextColleges } from "@/lib/bot/rotation";
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
  it("prints the Google Doc field layout for each professor", () => {
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
    expect(text).toContain("professor's email: hamlen@utdallas.edu");
    expect(text).toContain("research: https://");
    expect(text).toContain("professor name: Kevin Hamlen");
    expect(text).toContain("professor college: The University of Texas at Dallas");
    expect(text).toContain("email draft:");
    expect(text).toContain("Subject: Undergraduate Research Interest in Software Security");
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

describe("Google Doc dedup and college cap", () => {
  it("parses professors already written to the doc", () => {
    const seen = parseSeenFromDocText(`
professor's email: hamlen@utdallas.edu
research: https://personal.utdallas.edu/~hamlen/
professor name: Kevin Hamlen
professor college: University of Texas at Dallas
email draft:
Hello
`);
    expect([...seen.emails]).toContain("hamlen@utdallas.edu");
    expect(seen.perCollege["University of Texas at Dallas"]).toBe(1);
  });

  it("never repeats an email and caps a college at 15", () => {
    const existing = Array.from({ length: 15 }, (_, index) => ({
      professorName: `Prof ${index}`,
      college: "MIT",
      professorEmail: `p${index}@mit.edu`,
      researchLink: "https://example.edu/p",
      emailHeader: "Subject",
      emailBody: "Hello",
      resumePath: "data/resume.pdf",
    }));
    const ledger = {
      nextCollegeIndex: 0,
      seenEmails: existing.map((pkg) => pkg.professorEmail),
      seenKeys: [],
      perCollege: { MIT: 15 },
    };
    const extra = {
      professorName: "New Person",
      college: "MIT",
      professorEmail: "new@mit.edu",
      researchLink: "https://example.edu/n",
      emailHeader: "Subject",
      emailBody: "Hello",
      resumePath: "data/resume.pdf",
    };
    expect(filterNewPackages([existing[0]!, extra], ledger).fresh).toEqual([]);
  });

  it("rotates to colleges that still have room", () => {
    const { colleges } = pickNextColleges(
      {
        nextCollegeIndex: 0,
        seenEmails: [],
        seenKeys: [],
        perCollege: { "University of Texas at Dallas": 15 },
      },
      2,
    );
    expect(colleges).not.toContain("University of Texas at Dallas");
    expect(colleges[0]).toBe("University of Texas at Austin");
  });
});
