import * as cheerio from "cheerio";
import {
  extractEmails,
  isGenericInbox,
  normalizeEmail,
  normalizeUrl,
  preferUniversityEmail,
} from "@/lib/security/email";

export type ExtractedFaculty = {
  fullName: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  emailSourceUrl: string | null;
  facultyPageUrl: string | null;
  labUrl: string | null;
  personalWebsite: string | null;
  snippet: string;
};

function splitName(fullName: string) {
  let cleaned = fullName
    .replace(/\s+/g, " ")
    .replace(/\b(Professor|Associate|Assistant|Instructor|Lecturer|Dr\.?|Ph\.D\.?|Chair)\b/gi, "")
    .trim();
  if (cleaned.includes(",")) {
    const [last, first] = cleaned.split(",").map((part) => part.trim());
    cleaned = `${first} ${last}`.replace(/\s+/g, " ").trim();
  }
  const parts = cleaned.split(" ").filter(Boolean);
  return {
    firstName: parts[0] ?? cleaned,
    lastName: parts.slice(1).join(" ") || cleaned,
    fullName: cleaned,
  };
}

function looksLikePersonName(value: string) {
  const trimmed = value.replace(/\b(Professor|Associate|Assistant|Instructor|Lecturer|Dr\.?)\b/gi, "").trim();
  if (trimmed.length < 4 || trimmed.length > 80) return false;
  if (/faculty|department|university|computer science|home|contact/i.test(trimmed)) return false;
  if (/^[A-Z][A-Za-z.'\-]+,\s+[A-Z][A-Za-z.'\-]+/.test(trimmed)) return true;
  return /^[A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){1,3}$/.test(trimmed);
}

function extractNameFromText(text: string) {
  const lastFirst = text.match(/[A-Z][A-Za-z.'\-]+,\s+[A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+)?/);
  if (lastFirst) return lastFirst[0];
  const firstLast = text.match(/[A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){1,3}/);
  return firstLast?.[0] ?? "";
}

export function extractVisibleText(html: string) {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, iframe").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

export function extractPageTitle(html: string) {
  const $ = cheerio.load(html);
  return $("title").first().text().replace(/\s+/g, " ").trim() || null;
}

export function extractFacultyFromDirectory(html: string, pageUrl: string, universityDomain?: string) {
  const $ = cheerio.load(html);
  const results: ExtractedFaculty[] = [];
  const seen = new Set<string>();

  $("a[href^='mailto:']").each((_, node) => {
    const href = $(node).attr("href") ?? "";
    const email = normalizeEmail(href.replace(/^mailto:/i, "").split("?")[0] ?? "");
    if (!email || isGenericInbox(email)) return;
    const container = $(node).closest("tr, li, article, div");
    const text = container.text().replace(/\s+/g, " ").trim() || $(node).text();
    const nameCandidate =
      container.find("a").filter((_, el) => looksLikePersonName($(el).text())).first().text() ||
      container.find("td").first().text() ||
      text.split(email)[0] ||
      "";
    const extractedName = extractNameFromText(nameCandidate) || extractNameFromText(text);
    if (!extractedName) return;
    const names = splitName(extractedName);
    const profileLink = container
      .find("a[href]")
      .filter((_, el) => {
        const hrefValue = $(el).attr("href") ?? "";
        return /faculty|people|profile|~|users\//i.test(hrefValue) && !hrefValue.startsWith("mailto:");
      })
      .first()
      .attr("href");
    const website = container
      .find("a")
      .filter((_, el) => /website|homepage|lab/i.test($(el).text()) || /website|homepage|lab/i.test($(el).attr("href") ?? ""))
      .first()
      .attr("href");
    const key = email || names.fullName.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      ...names,
      title: /professor|lecturer|scientist/i.exec(text)?.[0] ?? null,
      email,
      emailSourceUrl: pageUrl,
      facultyPageUrl: normalizeUrl(profileLink || pageUrl, pageUrl),
      labUrl: website ? normalizeUrl(website, pageUrl) : null,
      personalWebsite: website ? normalizeUrl(website, pageUrl) : null,
      snippet: text.slice(0, 500),
    });
  });

  if (results.length === 0) {
    const emails = preferUniversityEmail(extractEmails($.text()), universityDomain);
    if (emails) {
      const heading = $("h1, h2").first().text().trim();
      if (looksLikePersonName(heading)) {
        results.push({
          ...splitName(heading),
          title: null,
          email: emails,
          emailSourceUrl: pageUrl,
          facultyPageUrl: pageUrl,
          labUrl: null,
          personalWebsite: null,
          snippet: extractVisibleText(html).slice(0, 500),
        });
      }
    }
  }

  return results;
}

export function extractProfileDetails(html: string, pageUrl: string, universityDomain?: string) {
  const text = extractVisibleText(html);
  const $ = cheerio.load(html);
  const emails = extractEmails(`${$.html()}\n${text}`);
  const email = preferUniversityEmail(emails, universityDomain);
  const links = $("a[href]")
    .map((_, el) => normalizeUrl($(el).attr("href") ?? "", pageUrl))
    .get()
    .filter((url): url is string => Boolean(url));
  const labUrl =
    links.find((url) => /lab|research|group/i.test(url) && url !== pageUrl) ?? null;
  const personalWebsite =
    links.find((url) => /personal|people\.|\/~/i.test(url) && url !== pageUrl) ?? labUrl;
  return {
    text,
    title: extractPageTitle(html),
    email,
    emailSourceUrl: email ? pageUrl : null,
    labUrl,
    personalWebsite,
    links: links.slice(0, 30),
  };
}

export function sourcePriority(url: string, universityDomain?: string) {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const domain = universityDomain?.replace(/^www\./, "").toLowerCase();
  if (domain && (host === domain || host.endsWith(`.${domain}`))) {
    if (/faculty|people|cs\.|eecs|engineering/.test(url)) return 1;
    if (/lab|research/.test(url)) return 2;
    return 3;
  }
  if (/arxiv\.org|acm\.org|ieee\.org|dl\.acm/.test(host)) return 5;
  return 6;
}
