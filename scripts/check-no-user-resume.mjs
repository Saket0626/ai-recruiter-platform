#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execSync("git ls-files -- 'data/resume.pdf' '**/resume.pdf'", { encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((file) => !file.includes("/fixtures/"));

if (tracked.length) {
  console.error("User resume PDF must never be committed:\n" + tracked.join("\n"));
  process.exit(1);
}

const gitignore = readFileSync(".gitignore", "utf8");
if (/^!\s*\/?data\/resume\.pdf/m.test(gitignore)) {
  console.error(".gitignore must not allow-list data/resume.pdf");
  process.exit(1);
}

console.log("Resume git check passed.");
