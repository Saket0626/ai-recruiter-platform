import { USER_AGENT } from "@/lib/config/defaults";
import { logger } from "@/lib/logging/logger";
import { getCachedPage, putCachedPage } from "@/lib/research/page-cache";
import { fetchPublicHtml } from "@/lib/search/fetch-public";

export type RobotsRule = {
  type: "allow" | "disallow";
  prefix: string;
};

export type RobotsGroup = {
  agents: string[];
  rules: RobotsRule[];
};

function agentToken(userAgent: string) {
  return userAgent.split(/[/\s]/)[0]?.toLowerCase() || "researchreach";
}

export function parseRobotsTxt(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let startingAgents = true;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "user-agent") {
      if (!current || !startingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
        startingAgents = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current) continue;
    if (field === "allow" || field === "disallow") {
      startingAgents = false;
      current.rules.push({ type: field, prefix: value });
    }
  }
  return groups;
}

function selectGroup(groups: RobotsGroup[], userAgent: string): RobotsGroup | null {
  const token = agentToken(userAgent);
  const specific = groups.find((group) =>
    group.agents.some((agent) => agent !== "*" && (agent === token || token.startsWith(agent))),
  );
  if (specific) return specific;
  return groups.find((group) => group.agents.includes("*")) ?? null;
}

export function pathAllowedByRobots(pathname: string, text: string, userAgent = USER_AGENT) {
  const groups = parseRobotsTxt(text);
  const group = selectGroup(groups, userAgent);
  if (!group) return true;
  const path = pathname || "/";
  let bestLen = -1;
  let allowed = true;
  for (const rule of group.rules) {
    if (rule.type === "disallow" && rule.prefix === "") continue;
    const prefix = rule.prefix || "/";
    if (!path.startsWith(prefix)) continue;
    if (prefix.length < bestLen) continue;
    bestLen = prefix.length;
    allowed = rule.type === "allow";
  }
  return allowed;
}

function robotsCacheUrl(origin: string) {
  return `${origin}/robots.txt`;
}

export async function isUrlAllowedByRobots(raw: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const cacheKey = robotsCacheUrl(url.origin);
  let body: string | null = null;
  const cached = await getCachedPage(cacheKey);
  if (cached) {
    if (cached.statusCode >= 400) return true;
    body = cached.body;
  } else {
    const fetched = await fetchPublicHtml(cacheKey);
    await putCachedPage({
      url: cacheKey,
      body: fetched.html,
      statusCode: fetched.status || (fetched.ok ? 200 : 0),
      contentType: "text/plain",
    });
    if (!fetched.ok) return true;
    body = fetched.html;
  }
  const allowed = pathAllowedByRobots(url.pathname || "/", body ?? "", USER_AGENT);
  if (!allowed) {
    logger.info("robots_disallowed", { url: raw, host: url.host });
    logger.info("evidence_collection_skipped", { url: raw, reason: "robots_disallowed" });
  }
  return allowed;
}
