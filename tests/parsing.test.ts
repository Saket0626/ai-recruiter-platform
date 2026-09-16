import { describe, expect, it } from "vitest";
import { extractEmails, isGenericInbox, normalizeEmail, normalizeUrl, preferUniversityEmail } from "@/lib/security/email";
import { extractFacultyFromDirectory, looksLikePersonName } from "@/lib/research/parser";
import { identityKey } from "@/lib/security/email";
import { hasAiResearch, topicSupportedByEvidence } from "@/lib/research/keywords";

const directory = `
<html><body>
<table>
<tr>
<td>Hamlen, Kevin Professor</td>
<td><a href="mailto:hamlen@utdallas.edu">hamlen@utdallas.edu</a> <a href="https://personal.utdallas.edu/~hamlen/">Website</a></td>
</tr>
<tr>
<td>Wei, Shiyi Associate Professor</td>
<td><a href="mailto:swei@utdallas.edu">swei@utdallas.edu</a></td>
</tr>
</table>
<a href="mailto:info@utdallas.edu">info@utdallas.edu</a>
</body></html>
`;

describe("email extraction and normalization", () => {
  it("normalizes addresses", () => {
    expect(normalizeEmail("  Hamlen@UTDallas.EDU ")).toBe("hamlen@utdallas.edu");
  });

  it("blocks generic inboxes", () => {
    expect(isGenericInbox("info@cs.utdallas.edu")).toBe(true);
    expect(isGenericInbox("admissions@mit.edu")).toBe(true);
    expect(isGenericInbox("oea@cs.utexas.edu")).toBe(true);
    expect(isGenericInbox("cse-general@cse.tamu.edu")).toBe(true);
    expect(isGenericInbox("gxa120930@utdallas.edu")).toBe(true);
    expect(isGenericInbox("hamlen@utdallas.edu")).toBe(false);
    expect(isGenericInbox("farokh.bastani@utdallas.edu")).toBe(false);
  });

  it("extracts emails from text", () => {
    expect(extractEmails(directory)).toContain("hamlen@utdallas.edu");
  });

  it("prefers university addresses", () => {
    expect(
      preferUniversityEmail(["kevin@gmail.com", "hamlen@utdallas.edu"], "utdallas.edu"),
    ).toBe("hamlen@utdallas.edu");
  });

  it("normalizes URLs", () => {
    expect(normalizeUrl("https://cs.utdallas.edu/people/faculty/#a")).toBe(
      "https://cs.utdallas.edu/people/faculty",
    );
  });

  it("parses faculty directory rows", () => {
    const people = extractFacultyFromDirectory(directory, "https://cs.utdallas.edu/people/faculty/", "utdallas.edu");
    expect(people.some((person) => person.email === "hamlen@utdallas.edu")).toBe(true);
    expect(people.find((person) => person.email === "hamlen@utdallas.edu")?.lastName).toBe("Hamlen");
    expect(people.every((person) => person.email !== "info@utdallas.edu")).toBe(true);
  });

  it("does not treat page chrome as a professor", () => {
    const html = `
      <html><body>
        <a href="#main">Skip to main content Search SearchMenu Computer Science People</a>
        <a href="mailto:dam@seas.harvard.edu">dam@seas.harvard.edu</a>
      </body></html>
    `;
    const people = extractFacultyFromDirectory(html, "https://cs.harvard.edu/people", "harvard.edu");
    expect(people.every((person) => !/skip to main/i.test(person.fullName))).toBe(true);
    expect(looksLikePersonName("Skip To Main")).toBe(false);
    expect(looksLikePersonName("External Affairs")).toBe(false);
    expect(looksLikePersonName("Graduate Office")).toBe(false);
    expect(looksLikePersonName("Clay Shields Position")).toBe(false);
  });

  it("uses a stable identity key", () => {
    expect(identityKey({ emailNormalized: "a@b.edu", university: "X", fullName: "A B" })).toBe("email:a@b.edu");
  });

  it("treats family keyword terms as evidence for a topic label", () => {
    expect(topicSupportedByEvidence("program analysis", "The lab uses static analysis on binaries.")).toBe(true);
    expect(topicSupportedByEvidence("natural language processing", "This page has no research.")).toBe(false);
    expect(hasAiResearch("Research in large language models and machine learning.")).toBe(true);
    expect(hasAiResearch("Office hours are Monday through Friday.")).toBe(false);
  });
});
