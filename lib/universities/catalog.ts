import { z } from "zod";
import universitiesJson from "@/data/universities.json";

export const universitySchema = z.object({
  name: z.string(),
  shortName: z.string(),
  aliases: z.array(z.string()).default([]),
  domain: z.string(),
  departments: z.array(z.string()),
  facultyDirectories: z.array(z.string()),
  nationalRank: z.number().nullable().optional(),
  inTop100: z.boolean().optional().default(false),
});

export type University = z.infer<typeof universitySchema>;

export const UNIVERSITIES: University[] = z.array(universitySchema).parse(universitiesJson);

export const DEFAULT_UNIVERSITY_NAME = "University of Texas at Dallas";

export const TOP_CS_DOMAINS = [
  "mit.edu",
  "stanford.edu",
  "cmu.edu",
  "berkeley.edu",
  "illinois.edu",
  "cornell.edu",
  "gatech.edu",
  "caltech.edu",
  "princeton.edu",
  "umich.edu",
  "utexas.edu",
  "washington.edu",
  "columbia.edu",
  "ucla.edu",
  "ucsd.edu",
  "harvard.edu",
  "wisc.edu",
  "purdue.edu",
  "umd.edu",
  "nyu.edu",
  "usc.edu",
  "uci.edu",
  "umass.edu",
  "upenn.edu",
  "duke.edu",
  "jhu.edu",
  "utdallas.edu",
];

export type UniversityPreset = "custom" | "top100" | "top-cs";

export type ResolvedUniversity = {
  name: string;
  shortName: string;
  domain: string;
  department: string;
  departments: string[];
  seedUrls: string[];
  nationalRank: number | null;
  inTop100: boolean;
};

export function getDefaultUniversity(): University {
  const utd = UNIVERSITIES.find((u) => u.name === DEFAULT_UNIVERSITY_NAME);
  if (!utd) throw new Error("Default university missing from catalog");
  return utd;
}

export function getTop100Universities(): University[] {
  return UNIVERSITIES.filter((university) => university.inTop100)
    .sort(
      (a, b) =>
        (a.nationalRank ?? 999) - (b.nationalRank ?? 999) || a.name.localeCompare(b.name),
    )
    .slice(0, 100);
}

export function getTopCsUniversities(): University[] {
  const byDomain = new Map(UNIVERSITIES.map((university) => [university.domain, university]));
  return TOP_CS_DOMAINS.map((domain) => byDomain.get(domain)).filter(
    (university): university is University => Boolean(university),
  );
}

export function universitiesForPreset(preset: UniversityPreset): University[] {
  if (preset === "top100") return getTop100Universities();
  if (preset === "top-cs") return getTopCsUniversities();
  return [getDefaultUniversity()];
}

export function normalizeUniversityQuery(value: string) {
  return value.trim().toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
}

export function findUniversity(query: string): University | undefined {
  const q = normalizeUniversityQuery(query);
  if (!q) return undefined;
  const exact = UNIVERSITIES.find((university) => {
    const haystacks = [university.name, university.shortName, university.domain, ...university.aliases].map(
      normalizeUniversityQuery,
    );
    return haystacks.some((item) => item === q);
  });
  if (exact) return exact;
  return UNIVERSITIES.find((university) => {
    const haystacks = [university.name, university.shortName, university.domain, ...university.aliases].map(
      normalizeUniversityQuery,
    );
    return haystacks.some((item) => item.includes(q) || q.includes(item));
  });
}

export function searchUniversities(query: string, limit = 20): University[] {
  const q = normalizeUniversityQuery(query);
  if (!q) return UNIVERSITIES.slice(0, limit);
  const scored = UNIVERSITIES.map((university) => {
    const fields = [university.name, university.shortName, university.domain, ...university.aliases].map(
      normalizeUniversityQuery,
    );
    let score = 0;
    for (const field of fields) {
      if (field === q) score += 100;
      else if (field.startsWith(q)) score += 40;
      else if (field.includes(q)) score += 20;
    }
    return { university, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.university.name.localeCompare(b.university.name));
  return scored.slice(0, limit).map((row) => row.university);
}

export function hydrateUniversity(
  matched: University,
  input?: { university?: string; universityDomain?: string; seedUrls?: string[]; department?: string },
): ResolvedUniversity {
  const domain = (input?.universityDomain || matched.domain).replace(/^www\./, "").toLowerCase();
  const seedUrls = [...(input?.seedUrls ?? []), ...matched.facultyDirectories].filter(Boolean);
  return {
    name: input?.university?.trim() || matched.name,
    shortName: matched.shortName,
    domain,
    department: input?.department || matched.departments[0] || "Computer Science",
    departments: matched.departments,
    seedUrls: [...new Set(seedUrls)],
    nationalRank: matched.nationalRank ?? null,
    inTop100: Boolean(matched.inTop100),
  };
}

export function resolveUniversitySelection(input: {
  university?: string;
  universityDomain?: string;
  seedUrls?: string[];
  department?: string;
}): ResolvedUniversity {
  const matched =
    (input.university ? findUniversity(input.university) : undefined) ??
    (input.universityDomain
      ? UNIVERSITIES.find((university) => {
          const domain = input.universityDomain!.replace(/^www\./, "").toLowerCase();
          return university.domain === domain;
        })
      : undefined) ??
    getDefaultUniversity();
  return hydrateUniversity(matched, input);
}

export function resolveUniversitySelections(input: {
  preset?: UniversityPreset | string | null;
  university?: string;
  universities?: string[];
  universityDomain?: string;
  seedUrls?: string[];
  department?: string;
}): ResolvedUniversity[] {
  if (input.preset === "top100" || input.preset === "top-cs") {
    return universitiesForPreset(input.preset).map((university) =>
      hydrateUniversity(university, { department: input.department }),
    );
  }

  const names = [
    ...(input.universities ?? []),
    ...(input.university && !(input.universities?.length) ? [input.university] : []),
  ]
    .map((name) => name.trim())
    .filter(Boolean);

  const unique = new Map<string, ResolvedUniversity>();
  for (const name of names) {
    const resolved = resolveUniversitySelection({
      university: name,
      department: input.department,
    });
    unique.set(resolved.domain, resolved);
  }

  if (!unique.size) {
    unique.set(
      "utdallas.edu",
      resolveUniversitySelection({
        university: input.university,
        universityDomain: input.universityDomain,
        seedUrls: input.seedUrls,
        department: input.department,
      }),
    );
  }

  const selected = [...unique.values()];
  if (selected.length === 1 && (input.seedUrls?.length || input.universityDomain)) {
    selected[0] = resolveUniversitySelection({
      university: selected[0]!.name,
      universityDomain: input.universityDomain || selected[0]!.domain,
      seedUrls: input.seedUrls,
      department: input.department,
    });
  }
  return selected;
}
