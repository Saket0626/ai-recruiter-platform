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
  "Postgres",
  "Git",
  "GitHub",
  "Railway",
  "Cloudflare",
  "REST APIs",
  "Linux",
  "Networking",
  "Wireshark",
  "Chrome Extension",
  "Manifest V3",
  "Cursor",
  "Google Analytics",
  "SEO",
  "Data Analysis",
];

const SECTION_ALIASES: Record<string, string> = {
  education: "education",
  "relevant experience": "experience",
  "work experience": "experience",
  experience: "experience",
  projects: "projects",
  project: "projects",
  "technical skills": "skills",
  skills: "skills",
};

type ResumeBlock = {
  title: string;
  role: string;
  bullets: string[];
};

function normalizeHeading(line: string) {
  return line.trim().toLowerCase().replace(/:$/, "");
}

function splitSections(text: string) {
  const sections: Record<string, string[]> = { preamble: [] };
  let current = "preamble";
  for (const raw of text.split(/\n/)) {
    const heading = SECTION_ALIASES[normalizeHeading(raw)];
    if (heading) {
      current = heading;
      sections[current] ??= [];
      continue;
    }
    sections[current] ??= [];
    sections[current].push(raw);
  }
  return Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, value.join("\n")]));
}

function lines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isBullet(line: string) {
  return /^[•\u2022\-*]/.test(line);
}

function cleanBullet(line: string) {
  return line.replace(/^[•\u2022\-*\s]+/, "").trim();
}

function isLikelyRole(line: string) {
  return /\b(intern|engineer|developer|analyst|assistant|contributor)\b/i.test(line) && line.length < 100;
}

function joinWrapped(previous: string, next: string) {
  if (previous.endsWith("-") && /^[a-z]/.test(next)) return `${previous.slice(0, -1)}${next}`;
  return `${previous} ${next}`;
}

function titleBeforeMeta(title: string) {
  return title.split("|")[0]?.replace(/\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b.*$/i, "").replace(/\s+\d{4}.*$/, "").trim() || title;
}

function parseBlocks(sectionText: string): ResumeBlock[] {
  const blocks: ResumeBlock[] = [];
  let current: ResumeBlock | null = null;

  for (const line of lines(sectionText)) {
    if (isBullet(line)) {
      if (!current) current = { title: "Untitled", role: "", bullets: [] };
      current.bullets.push(cleanBullet(line));
      continue;
    }
    if (current && current.bullets.length > 0) {
      const last = current.bullets[current.bullets.length - 1] ?? "";
      if (!/[.!?]$/.test(last) || last.endsWith("-") || /^[a-z]/.test(line)) {
        current.bullets[current.bullets.length - 1] = joinWrapped(last, line);
        continue;
      }
    }
    if (current && current.role === "" && current.bullets.length === 0 && isLikelyRole(line)) {
      current.role = line;
      continue;
    }
    if (current) blocks.push(current);
    current = { title: line, role: "", bullets: [] };
  }
  if (current) blocks.push(current);
  return blocks.filter((block) => block.title !== "Untitled" || block.bullets.length > 0);
}

function verbsIn(text: string) {
  return [...text.matchAll(/\b(helped|contributed|built|created|developed|used|designed|implemented|worked|launched|analyzed|applied|extended|refined)\b/gi)].map(
    (match) => match[1]!.toLowerCase(),
  );
}

function skillsFrom(text: string) {
  return SKILL_CANDIDATES.filter((skill) => {
    const pattern = new RegExp(`\\b${skill.replace(".", "\\.")}\\b`, "i");
    return pattern.test(text) || (skill === "HTML" && /html\/css/i.test(text)) || (skill === "JavaScript" && /javascript\/typescript/i.test(text));
  }).map((skill) => (skill === "Postgres" ? "PostgreSQL" : skill))
    .filter((skill, index, all) => all.indexOf(skill) === index);
}

function titleCaseName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .trim();
}

function parseEducation(text: string, preamble: string) {
  const blob = `${preamble}\n${text}`;
  const university =
    blob.match(/The University of Texas at Dallas|University of Texas at Dallas|UT Dallas/i)?.[0] ?? DEFAULT_STUDENT.university;
  const degree =
    blob.match(/B\.?S\.?[^\n,]*Computer Information Systems and Technology/i)?.[0]?.replace(/\s+/g, " ").trim() ??
    DEFAULT_STUDENT.degree;
  const minorMatch = blob.match(/Minor(?:\s+in)?\s+([A-Za-z][A-Za-z /]*?)(?=\s+Expected|\s*$|,)/i);
  const graduationDate = blob.match(/Expected\s+[A-Za-z]+\s+\d{4}/i)?.[0] ?? DEFAULT_STUDENT.graduationDate;
  const firstLine = lines(preamble)[0] ?? DEFAULT_STUDENT.name;
  const name = /saket/i.test(firstLine) ? titleCaseName(firstLine.replace(/[^A-Za-z\s]/g, " ")) : DEFAULT_STUDENT.name;
  return {
    name: name || DEFAULT_STUDENT.name,
    university: /ut dallas/i.test(university) ? "The University of Texas at Dallas" : university,
    degree: degree.replace(/^B\.S\.\s/i, "B.S. "),
    minor: minorMatch?.[1]?.trim() || DEFAULT_STUDENT.minor,
    graduationDate,
    currentStatus: DEFAULT_STUDENT.currentStatus,
  };
}

export function parseResumeText(resumeText: string, resumePath: string): StudentProfile {
  const sections = splitSections(resumeText);
  const identity = parseEducation(sections.education ?? "", sections.preamble ?? "");
  const experienceBlocks = parseBlocks(sections.experience ?? "");
  const projectBlocks = parseBlocks(sections.projects ?? "");

  const experiences = experienceBlocks.map((block) => ({
    organization: titleBeforeMeta(block.title),
    role: block.role.replace(/\s+(Dallas|Orlando|Richardson|TX|FL).*$/i, "").trim(),
    summary: block.bullets.join(" ") || lines(block.title).join(" "),
    verbs: verbsIn(`${block.role} ${block.bullets.join(" ")}`),
  }));

  const experienceNames = new Set(experiences.map((item) => item.organization.toLowerCase()));
  const projects = projectBlocks
    .map((block) => ({
      name: titleBeforeMeta(block.title),
      summary: block.bullets.join(" ") || block.title,
      technologies: skillsFrom(`${block.title} ${block.bullets.join(" ")}`),
      verbs: verbsIn(block.bullets.join(" ")),
    }))
    .filter((project) => project.name.length > 2 && !experienceNames.has(project.name.toLowerCase()));

  const technicalSkills = skillsFrom(sections.skills || resumeText);
  const accomplishments = [
    ...experiences.flatMap((item) => (item.summary ? [`${item.organization}: ${item.summary}`] : [])),
    ...projects.map((project) => `${project.name}: ${project.summary}`),
  ];

  return {
    ...identity,
    experiences,
    projects,
    technicalSkills,
    accomplishments,
    resumePath,
    resumeText,
  };
}
