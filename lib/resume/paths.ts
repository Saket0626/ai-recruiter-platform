import { existsSync } from "node:fs";
import path from "node:path";
import { getEnv } from "@/lib/config/env";

export const DEFAULT_RESUME_RELATIVE = "data/resume.pdf";
export const RAILWAY_VOLUME_RESUME = "/app/resume-data/resume.pdf";

export function absoluteResumePath(configured: string) {
  return path.isAbsolute(configured) ? configured : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

export function resumeSearchPaths(override?: string) {
  if (override) return [absoluteResumePath(override)];
  const configured = getEnv().RESUME_PATH || DEFAULT_RESUME_RELATIVE;
  const ordered = [
    absoluteResumePath(configured),
    RAILWAY_VOLUME_RESUME,
    absoluteResumePath(DEFAULT_RESUME_RELATIVE),
  ];
  return [...new Set(ordered)];
}

export function resolveResumePath(override?: string) {
  const paths = resumeSearchPaths(override);
  return paths.find((candidate) => existsSync(candidate)) ?? paths[0]!;
}
