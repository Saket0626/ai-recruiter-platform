import { normalizeUrl } from "@/lib/security/email";

const PUBLICATION_HINT =
  /selected publications|recent publications|google scholar|publications list|published in|proceedings of|arxiv\.org|acm trans|ieee trans|journal of|conference on|dblp\.org|\bdoi:\s*10\./i;

const PUBLICATION_URL =
  /scholar\.google|orcid\.org|arxiv\.org|dblp\.org|dl\.acm\.org|ieeexplore\.ieee\.org|publications|papers\.html|\/papers\/|curriculum|cv\.pdf/i;

export function hasPublishedResearch(text: string, urls: string[] = []) {
  if (PUBLICATION_HINT.test(text.replace(/\s+/g, " "))) return true;
  return urls.some((url) => PUBLICATION_URL.test(url));
}

export function publicationLinks(urls: Array<string | null | undefined>, pageUrl?: string) {
  const unique = new Set<string>();
  for (const raw of urls) {
    const normalized = raw ? normalizeUrl(raw, pageUrl) : null;
    if (!normalized) continue;
    if (!PUBLICATION_URL.test(normalized)) continue;
    unique.add(normalized);
  }
  return [...unique].slice(0, 4);
}

export function primaryResearchLink(urls: string[]) {
  const publications = publicationLinks(urls);
  return publications[0] ?? urls.find((url) => Boolean(url)) ?? null;
}
