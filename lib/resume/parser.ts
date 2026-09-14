import { DEFAULT_STUDENT } from "@/lib/config/defaults";
import type { StudentProfile } from "@/lib/validation/schemas";

const SKILL_CANDIDATES = [
  "Python",
  "Java",
  "SQL",
  "JavaScript",
  "TypeScript",
  "HTML",
  "CSS",
  "React",
  "Next.js",
  "Supabase",
  "PostgreSQL",
  "Git",
  "GitHub",
  "Railway",
  "Cloudflare",
  "REST APIs",
  "Linux",
  "Networking",
  "Wireshark",
];

function section(text: string, heading: string) {
  const pattern = new RegExp(`${heading}[:\\n]([\\s\\S]*?)(?:\\n[A-Z][A-Z ]{3,}\\n|$)`, "i");
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function lines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function verbsIn(text: string) {
  return [...text.matchAll(/\b(helped|contributed|built|created|developed|used|designed|implemented|worked)\b/gi)].map(
    (match) => match[1]!.toLowerCase(),
  );
}

export function parseResumeText(resumeText: string, resumePath: string): StudentProfile {
  const experiences: StudentProfile["experiences"] = [];
  const projects: StudentProfile["projects"] = [];
  const experienceBlock = section(resumeText, "EXPERIENCE") || section(resumeText, "WORK EXPERIENCE");
  const projectBlock = section(resumeText, "PROJECTS") || section(resumeText, "PROJECT");

  for (const line of lines(experienceBlock || resumeText)) {
    if (/clinicalhours|internship|assistant|developer|engineer/i.test(line) && line.length < 240) {
      experiences.push({
        organization: line.match(/clinicalhours/i) ? "ClinicalHours" : line.slice(0, 80),
        role: /help|contribut/i.test(line) ? "Contributor" : "",
        summary: line,
        verbs: verbsIn(line),
      });
    }
  }

  const projectNames = ["ClinicalHours", "Canvas Companion", "ChartWise", "Cloud of Goods"];
  for (const name of projectNames) {
    const mention = resumeText.split(/\n/).find((line) => line.toLowerCase().includes(name.toLowerCase()));
    if (mention) {
      projects.push({
        name,
        summary: mention.replace(/\s+/g, " ").trim(),
        technologies: SKILL_CANDIDATES.filter((skill) => new RegExp(skill.replace(".", "\\."), "i").test(resumeText)),
        verbs: verbsIn(mention),
      });
    }
  }

  if (projectBlock) {
    for (const line of lines(projectBlock)) {
      const known = projectNames.find((name) => line.toLowerCase().includes(name.toLowerCase()));
      if (!known && line.length > 12 && line.length < 280) {
        projects.push({
          name: line.slice(0, 60),
          summary: line,
          technologies: [],
          verbs: verbsIn(line),
        });
      }
    }
  }

  const technicalSkills = SKILL_CANDIDATES.filter((skill) => {
    const pattern = new RegExp(`\\b${skill.replace(".", "\\.")}\\b`, "i");
    return pattern.test(resumeText) || (skill === "HTML" && /html\/css/i.test(resumeText));
  });

  const uniqueExperiences = experiences.filter(
    (item, index, all) => all.findIndex((other) => other.summary === item.summary) === index,
  );
  const uniqueProjects = projects.filter(
    (item, index, all) => all.findIndex((other) => other.name.toLowerCase() === item.name.toLowerCase()) === index,
  );

  return {
    name: DEFAULT_STUDENT.name,
    university: DEFAULT_STUDENT.university,
    degree: DEFAULT_STUDENT.degree,
    minor: DEFAULT_STUDENT.minor,
    graduationDate: DEFAULT_STUDENT.graduationDate,
    currentStatus: DEFAULT_STUDENT.currentStatus,
    experiences: uniqueExperiences,
    projects: uniqueProjects,
    technicalSkills,
    accomplishments: uniqueProjects.map((project) => project.summary),
    resumePath,
    resumeText,
  };
}
