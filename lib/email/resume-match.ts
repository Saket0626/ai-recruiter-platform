import type { StudentProfile } from "@/lib/validation/schemas";
import type { VerifiedResearch } from "@/lib/research/interpret";

export type ResumeMatch = {
  experienceName: string;
  verifiedFact: string;
  conceptualBridge: string;
  whyNatural: string;
  confidence: "high" | "medium" | "low";
  honestCuriosity: boolean;
};

type NamedWork = {
  name: string;
  summary: string;
};

function works(profile: StudentProfile): NamedWork[] {
  return [
    ...profile.experiences.map((item) => ({ name: item.organization, summary: item.summary })),
    ...profile.projects.map((item) => ({ name: item.name, summary: item.summary })),
  ];
}

function named(profile: StudentProfile, name: string) {
  return works(profile).find((item) => item.name.toLowerCase() === name.toLowerCase());
}

function firstFact(work: NamedWork | undefined) {
  if (!work) return "worked on undergraduate software projects";
  const summary = work.summary.replace(/\s+/g, " ").trim().replace(/^I\s+/i, "").replace(/[.]+$/, "");
  if (!summary || summary.toLowerCase() === work.name.toLowerCase() || /^(experience|projects|education|skills)\b/i.test(summary)) {
    return `helped with ${work.name}`;
  }
  const first = summary.match(/^.+?[.](?=\s|$)/)?.[0] || summary;
  const words = first.replace(/[.]+$/, "").split(/\s+/).filter(Boolean);
  return (words.length > 28 ? `${words.slice(0, 28).join(" ")}` : words.join(" ")).replace(/[,:]+$/g, "");
}

function topicBlob(research: VerifiedResearch, topics: string[]) {
  return `${research.broadArea} ${research.specificProblem} ${topics.join(" ")}`.toLowerCase();
}

export function matchResumeToResearch(input: {
  student: StudentProfile;
  research: VerifiedResearch;
  topics: string[];
}): ResumeMatch {
  const blob = topicBlob(input.research, input.topics);
  const clinical = named(input.student, "ClinicalHours");
  const canvas = named(input.student, "Canvas Companion");
  const chartwise = named(input.student, "ChartWise");
  const cloud = named(input.student, "Cloud of Goods");
  const crush = named(input.student, "Crush It Sports");

  const mismatch =
    /\b(control theory|autonomous systems|return-oriented programming|40-hz|interictal|seizure|spectral imaging|music information|robotics|ideal observer|linear system theory)\b/i.test(
      blob,
    ) &&
    !/\b(software|security|vulnerab|privacy|program analysis|binary rewriting)\b/i.test(blob);

  if (/\b(vulnerab|program analysis|binary rewriting|access control|software security)\b/i.test(blob) && clinical) {
    return {
      experienceName: "ClinicalHours",
      verifiedFact: firstFact(clinical),
      conceptualBridge:
        "Working on a real application made me curious about how weaknesses in software that handles users can be identified before they become problems.",
      whyNatural: "Undergraduate software development is a defensible entry to software security research.",
      confidence: "high",
      honestCuriosity: false,
    };
  }

  if (
    /\b(database|data mining|data management|geo-replicated|information systems|analytics|pipeline)\b/i.test(blob) &&
    (chartwise || clinical)
  ) {
    const work = chartwise ?? clinical!;
    return {
      experienceName: work.name,
      verifiedFact: firstFact(work),
      conceptualBridge:
        "Working with real data in a software project made me curious about how researchers organize, query, and extract insight from large information collections.",
      whyNatural: "Resume data or product work is a reasonable bridge to data systems research.",
      confidence: "medium",
      honestCuriosity: false,
    };
  }

  if (/\b(security|privacy|cyber)\b/i.test(blob) && clinical) {
    return {
      experienceName: "ClinicalHours",
      verifiedFact: firstFact(clinical),
      conceptualBridge:
        "Working on software that handles user information made me curious about how that information is protected as systems get larger.",
      whyNatural: "Product software with user information is a modest bridge to privacy research.",
      confidence: "medium",
      honestCuriosity: false,
    };
  }

  if (
    /\b(natural language|language model|nlp|syllabus|document|information retrieval)\b/i.test(blob) &&
    canvas
  ) {
    return {
      experienceName: "Canvas Companion",
      verifiedFact: firstFact(canvas),
      conceptualBridge:
        "Extracting and organizing unstructured course information made me curious about how researchers teach computers to understand language and documents.",
      whyNatural: "Syllabus extraction is conceptually related to language and information processing.",
      confidence: "medium",
      honestCuriosity: false,
    };
  }

  if (/\b(human-computer|hci|user interface|interactive systems)\b/i.test(blob) && (crush || canvas || clinical)) {
    const work = crush ?? canvas ?? clinical!;
    return {
      experienceName: work.name,
      verifiedFact: firstFact(work),
      conceptualBridge:
        "Helping people use a software system made me curious about how researchers study the way people interact with technology.",
      whyNatural: "User-facing software or customer-facing technology work can connect to HCI.",
      confidence: crush ? "medium" : "low",
      honestCuriosity: false,
    };
  }

  if (/\b(machine learning|artificial intelligence)\b/i.test(blob) && canvas && !mismatch) {
    return {
      experienceName: "Canvas Companion",
      verifiedFact: firstFact(canvas),
      conceptualBridge:
        "Using software that organizes messy information made me want to understand the methods behind systems that learn from data.",
      whyNatural: "Honest curiosity from software work toward machine learning, without claiming ML experience.",
      confidence: "low",
      honestCuriosity: false,
    };
  }

  if (cloud && /\b(analytics|experiment|market|platform)\b/i.test(blob)) {
    return {
      experienceName: "Cloud of Goods",
      verifiedFact: firstFact(cloud),
      conceptualBridge:
        "Looking at customer and product data made me curious about how researchers study behavior and measurement on digital platforms.",
      whyNatural: "Analytics work can connect to platform or measurement research if kept modest.",
      confidence: "low",
      honestCuriosity: false,
    };
  }

  const fallback = clinical ?? canvas ?? chartwise ?? works(input.student)[0];
  const topic = input.research.specificProblem || input.research.broadArea;
  return {
    experienceName: fallback?.name || "undergraduate software projects",
    verifiedFact: fallback ? firstFact(fallback) : "worked on undergraduate software projects",
    conceptualBridge: `I have not yet worked directly with ${topic}, but this research caught my attention because I want to expand my technical experience beyond the software projects I have worked on.`,
    whyNatural: "No strong resume bridge. Honest curiosity is better than a fake connection.",
    confidence: "low",
    honestCuriosity: true,
  };
}
