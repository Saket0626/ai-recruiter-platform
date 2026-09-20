import { describe, expect, it } from "vitest";
import { generateGroundedEmail } from "@/lib/email/generator";
import { extractGroundedResearchDetail } from "@/lib/email/research-detail";
import { matchResumeToResearch } from "@/lib/email/resume-match";
import { interpretProfessorResearch } from "@/lib/research/interpret";
import { classifyTextBlock, containsPageGarbage } from "@/lib/research/page-classify";
import { validateEmailDraft } from "@/lib/validation/email-quality";
import { parseResumeText } from "@/lib/resume/parser";

const student = parseResumeText(
  `SAKET
EXPERIENCE
ClinicalHours
Helped with the development of the ClinicalHours website, using AI to help with development.
PROJECTS
Canvas Companion
Helped build syllabus extraction and LLM parsing features using TypeScript.
ChartWise
Helped with a market data pipeline using SQL.
Cloud of Goods
Contributed to a web project using React.
TECHNICAL SKILLS
Python TypeScript Linux Wireshark cybersecurity
`,
  "data/resume.pdf",
);

function failuresFor(body: string, topics: string[], evidence: string[]) {
  return validateEmailDraft({
    professorName: "Jane Smith",
    professorEmail: "smith@cs.example.edu",
    subject: "Undergraduate Research Interest in Software Security",
    body,
    topics,
    evidenceTexts: evidence,
    evidenceUrls: ["https://cs.example.edu/smith"],
    student,
    resumeAvailable: true,
    relevanceScore: 80,
    minScore: 65,
    insufficientEvidence: false,
  }).map((item) => item.code);
}

describe("research personalization quality", () => {
  it("TEST 1: rejects page garbage such as meeting times, rooms, and headings", () => {
    const garbage = "linear System Theory, TuTh 09:30-10:59, Cory 521 Selected Publications";
    expect(containsPageGarbage(garbage)).toBe(true);
    expect(classifyTextBlock(garbage)).toBe("COURSE_SCHEDULE");
    expect(
      extractGroundedResearchDetail({
        topics: ["artificial intelligence", "program analysis"],
        evidenceTexts: [garbage],
      }),
    ).toBeNull();
    expect(interpretProfessorResearch({ topics: ["artificial intelligence"], evidenceTexts: [garbage] }).generationAllowed).toBe(
      false,
    );
  });

  it("TEST 2: rejects ClinicalHours ownership language", () => {
    const body = [
      "Dear Dr. Smith,",
      "",
      "My name is Saket, and I am a first-year student at UT Dallas interested in pursuing Computer Information Systems and Technology. I am interested in your research on software security, particularly automated vulnerability detection. I built ClinicalHours.",
      "",
      "I have attached my resume for your review. I am available to start immediately and continue through the spring and beyond. Thank you for your time and consideration.",
      "",
      "Sincerely,",
      "Saket",
    ].join("\n");
    expect(failuresFor(body, ["software security"], ["The lab investigates automated vulnerability detection in software security."])).toContain(
      "clinicalhours_ownership",
    );
  });

  it("TEST 3: accepts helped-a-startup ClinicalHours language", () => {
    const draft = generateGroundedEmail({
      professorLastName: "Hamlen",
      professorFullName: "Kevin Hamlen",
      topics: ["software security", "program analysis"],
      researchSummary: "software security",
      student,
      evidenceTexts: [
        "The lab investigates binary rewriting defenses against return-oriented programming attacks. Software security and program analysis are used to harden binaries.",
      ],
    });
    expect(draft.body).toMatch(/helped a small startup, ClinicalHours, with software development/i);
    expect(draft.body).not.toMatch(/i (built|created|launched|founded|developed) clinicalhours/i);
  });

  it("TEST 4: rejects a fake Canvas Companion to control theory bridge", () => {
    const research = interpretProfessorResearch({
      topics: ["control theory"],
      evidenceTexts: ["The lab investigates coordination of autonomous control theory systems for vehicles."],
    });
    const match = matchResumeToResearch({ student, research, topics: ["control theory"] });
    expect(match.honestCuriosity).toBe(true);
    const body = [
      "Dear Dr. Arcak,",
      "",
      "My name is Saket, and I am a first-year student at UT Dallas interested in pursuing Computer Information Systems and Technology. I am interested in your research on control theory, particularly coordination of autonomous systems.",
      "",
      "Building Canvas Companion made me interested in control theory.",
      "",
      "My work on Canvas Companion made me curious about linear System Theory, TuTh 09:30-10:59, Cory 521 Selected Publications. I have attached my resume for your review. I am available to start immediately and continue through the spring and beyond.",
      "",
      "Sincerely,",
      "Saket",
    ].join("\n");
    const codes = failuresFor(body, ["control theory"], [
      "The lab investigates coordination of autonomous control theory systems for vehicles.",
    ]);
    expect(codes).toContain("page_garbage");
    expect(codes).toContain("fake_connection");
  });

  it("TEST 5: accepts a real software-development to vulnerability-detection bridge", () => {
    const draft = generateGroundedEmail({
      professorLastName: "Hamlen",
      professorFullName: "Kevin Hamlen",
      topics: ["software security"],
      researchSummary: "software security",
      student,
      evidenceTexts: [
        "The lab investigates automated vulnerability detection and binary rewriting defenses against return-oriented programming attacks. This is software security research.",
      ],
    });
    expect(draft.body).toMatch(/weaknesses in software|vulnerability detection|binary rewriting/i);
    expect(draft.body).toMatch(/ClinicalHours/i);
    expect(
      validateEmailDraft({
        professorName: "Kevin Hamlen",
        professorEmail: "hamlen@utdallas.edu",
        subject: draft.subject,
        body: draft.body,
        topics: ["software security"],
        evidenceTexts: [
          "The lab investigates automated vulnerability detection and binary rewriting defenses against return-oriented programming attacks. This is software security research.",
        ],
        evidenceUrls: ["https://cs.utdallas.edu/hamlen"],
        student,
        resumeAvailable: true,
        relevanceScore: 80,
        minScore: 65,
        insufficientEvidence: false,
      }).map((item) => item.code),
    ).toEqual([]);
  });

  it("TEST 6: rejects an unsupported professor claim", () => {
    const draft = generateGroundedEmail({
      professorLastName: "Smith",
      professorFullName: "Jane Smith",
      topics: ["AI agents"],
      researchSummary: "AI agents",
      student,
      evidenceTexts: ["The lab investigates database indexing and query optimization."],
    });
    const codes = validateEmailDraft({
      professorName: "Jane Smith",
      professorEmail: "smith@cs.example.edu",
      subject: draft.subject,
      body: draft.body,
      topics: ["AI agents"],
      evidenceTexts: ["The lab investigates database indexing and query optimization."],
      evidenceUrls: ["https://cs.example.edu/smith"],
      student,
      resumeAvailable: true,
      relevanceScore: 80,
      minScore: 65,
      insufficientEvidence: false,
    }).map((item) => item.code);
    expect(codes).toContain("unsupported_professor_claim");
  });

  it("TEST 7: rejects a generic email that could be sent to any CS professor", () => {
    const body = [
      "Dear Dr. Smith,",
      "",
      "My name is Saket, and I am a first-year student at UT Dallas interested in pursuing Computer Information Systems and Technology. I am interested in your research on computer science.",
      "",
      "I recently helped a small startup, ClinicalHours, with software development.",
      "",
      "I have attached my resume for your review. I am available to start immediately and continue through the spring and beyond. Thank you for your time and consideration.",
      "",
      "Sincerely,",
      "Saket",
    ].join("\n");
    const codes = failuresFor(
      body,
      ["software security"],
      ["The lab investigates binary rewriting defenses against return-oriented programming attacks on commodity software security tools."],
    );
    expect(codes.some((code) => code === "research_detail_missing" || code === "not_personalized")).toBe(true);
  });
});

describe("ten professor research fixtures", () => {
  const cases = [
    {
      name: "Kevin Hamlen",
      last: "Hamlen",
      university: "UT Dallas",
      topics: ["software security", "program analysis"],
      evidence: ["The lab investigates binary rewriting defenses against return-oriented programming attacks. Software security and program analysis are used to harden binaries."],
      expectPhrase: /binary rewriting|return-oriented programming/i,
      allowed: true,
    },
    {
      name: "Huseyin Cavusoglu",
      last: "Cavusoglu",
      university: "UT Dallas",
      topics: ["information systems", "information security and privacy"],
      evidence: ["Dr. Cavusoglu studies the economics of information security investments in organizations. His information systems work also covers information security and privacy."],
      expectPhrase: /economics of information security/i,
      allowed: true,
    },
    {
      name: "Andrew Thomas Campbell",
      last: "Campbell",
      university: "Dartmouth College",
      topics: ["machine learning", "human-computer interaction"],
      evidence: [
        "My research interests include using embedded sensors and machine learning on phones and wearables. This human-computer interaction work studies everyday sensing.",
      ],
      expectPhrase: /embedded sensors and machine learning on phones/i,
      allowed: true,
    },
    {
      name: "Sushant Agarwal",
      last: "Agarwal",
      university: "Northeastern University",
      topics: ["privacy"],
      evidence: [
        "A recent paper on privacy is Private Mean Estimation with Person-Level Differential Privacy SODA, 2819-2880.",
      ],
      expectPhrase: /person-level differential privacy|private mean estimation/i,
      allowed: true,
    },
    {
      name: "Elisa Bertino",
      last: "Bertino",
      university: "Purdue University",
      topics: ["cybersecurity", "privacy"],
      evidence: [
        "The lab investigates access control systems and secure publishing techniques for XML data. This cybersecurity and privacy research also covers secure broadcast.",
      ],
      expectPhrase: /access control systems|secure publishing/i,
      allowed: true,
    },
    {
      name: "Murat Arcak",
      last: "Arcak",
      university: "UC Berkeley",
      topics: ["artificial intelligence"],
      evidence: ["linear System Theory, TuTh 09:30-10:59, Cory 521 Selected Publications"],
      expectPhrase: null,
      allowed: false,
    },
    {
      name: "Augustin Chaintreau",
      last: "Chaintreau",
      university: "Columbia University",
      topics: ["artificial intelligence"],
      evidence: ["try again later.Articles 1,20Show morePrivacyTermsHelpAbout ScholarSearch help Loading..."],
      expectPhrase: null,
      allowed: false,
    },
    {
      name: "Yinzhi Cao",
      last: "Cao",
      university: "Johns Hopkins University",
      topics: ["cybersecurity"],
      evidence: ["he is the technical director of the Johns Hopkins University Information Security Institute"],
      expectPhrase: null,
      allowed: false,
    },
    {
      name: "Karla Badillo",
      last: "Badillo",
      university: "University of Notre Dame",
      topics: ["cybersecurity", "privacy"],
      evidence: ["the ones marked may be different from the article in the profile.Add co-authorsCo-authorsFollowNew"],
      expectPhrase: null,
      allowed: false,
    },
    {
      name: "Ahmed Hassan",
      last: "Hassan",
      university: "Lehigh University",
      topics: ["distributed systems"],
      evidence: ["rossin College ofEngineering and Applied Science Menu Search Apply / Inquire Search form Search"],
      expectPhrase: null,
      allowed: false,
    },
  ];

  for (const fixture of cases) {
    it(`${fixture.name} at ${fixture.university}`, () => {
      const research = interpretProfessorResearch({
        topics: fixture.topics,
        evidenceTexts: fixture.evidence,
      });
      expect(research.generationAllowed).toBe(fixture.allowed);
      const detail = extractGroundedResearchDetail({
        topics: fixture.topics,
        evidenceTexts: fixture.evidence,
      });
      if (!fixture.allowed) {
        expect(detail).toBeNull();
        return;
      }
      expect(detail).toMatch(fixture.expectPhrase!);
      const draft = generateGroundedEmail({
        professorLastName: fixture.last,
        professorFullName: fixture.name,
        topics: fixture.topics,
        researchSummary: fixture.topics[0],
        student,
        evidenceTexts: fixture.evidence,
      });
      expect(draft.body).toMatch(fixture.expectPhrase!);
      expect(draft.body).toMatch(new RegExp(`Dear Dr\\. ${fixture.last},`));
      expect(draft.body).not.toMatch(/TuTh|Cory 521|Selected Publications|Menu Search|try again later|Add co-authors/i);
      expect(draft.body).not.toMatch(/i (built|created|launched|founded) clinicalhours/i);
      const codes = validateEmailDraft({
        professorName: fixture.name,
        professorEmail: `${fixture.last.toLowerCase()}@cs.example.edu`,
        subject: draft.subject,
        body: draft.body,
        topics: fixture.topics,
        evidenceTexts: fixture.evidence,
        evidenceUrls: ["https://cs.example.edu/p"],
        student,
        resumeAvailable: true,
        relevanceScore: 80,
        minScore: 65,
        insufficientEvidence: false,
      });
      expect(codes.map((item) => item.code)).toEqual([]);
    });
  }
});
