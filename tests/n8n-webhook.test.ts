import { describe, expect, it } from "vitest";
import { n8nPayloadFromPackage } from "@/lib/bot/n8n";
import { studentSignature } from "@/lib/bot/identity";

describe("n8n webhook payload", () => {
  it("includes the four required fields and a real signature", () => {
    const payload = n8nPayloadFromPackage({
      professorName: "Kevin Hamlen",
      college: "University of Texas at Dallas",
      professorEmail: "hamlen@utdallas.edu",
      researchLink: "https://cs.utdallas.edu/hamlen",
      emailHeader: "Undergraduate Research Interest in Software Security",
      emailBody: `Dear Dr. Hamlen,\n\nMy name is Saket.\n\n${studentSignature()}`,
      resumePath: "data/resume.pdf",
    });
    expect(payload.professor_email).toBe("hamlen@utdallas.edu");
    expect(payload.professor_name).toBe("Dr. Kevin Hamlen");
    expect(payload.draft_subject).toBe("Undergraduate Research Interest in Software Security");
    expect(payload.draft_body).toContain("Saket Amanana");
    expect(payload.draft_body).toContain("saket.amanana@gmail.com");
    expect(payload.draft_body).not.toMatch(/\[Your Name\]|placeholder/i);
  });
});
