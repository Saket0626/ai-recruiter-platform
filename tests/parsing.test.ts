import { describe, expect, it } from "vitest";
import { extractEmails, isGenericInbox, normalizeEmail, normalizeUrl, preferUniversityEmail } from "@/lib/security/email";
import { extractFacultyFromDirectory } from "@/lib/research/parser";
import { identityKey } from "@/lib/security/email";

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
    expect(isGenericInbox("hamlen@utdallas.edu")).toBe(false);
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
    expect(people.every((person) => person.email !== "info@utdallas.edu")).toBe(true);
  });

  it("uses a stable identity key", () => {
    expect(identityKey({ emailNormalized: "a@b.edu", university: "X", fullName: "A B" })).toBe("email:a@b.edu");
  });
});
