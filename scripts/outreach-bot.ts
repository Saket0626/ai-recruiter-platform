import { prisma } from "@/lib/db/prisma";
import { COLLEGES_PER_RUN } from "@/lib/bot/config";
import { runOutreachBot, printOutreachPackages } from "@/lib/bot/run";

function flag(name: string) {
  return process.argv.includes(name);
}

function numberFlag(name: string, fallback: number) {
  const prefix = `${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  if (!hit) return fallback;
  const value = Number(hit.slice(prefix.length));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function main() {
  const send = flag("--send");
  const reportOnly = flag("--report");
  const maxCandidates = numberFlag("--max", 0);
  const collegesPerRun = numberFlag("--colleges", COLLEGES_PER_RUN);
  const result = await runOutreachBot({
    send,
    reportOnly,
    maxCandidates: maxCandidates || undefined,
    collegesPerRun,
  });
  console.log(printOutreachPackages(result.packages));
  console.log(`\nColleges this run: ${result.colleges.join(" | ") || "none"}`);
  console.log(`Wrote ${result.packages.length} new packages to ${result.outbox}`);
  console.log(`Cursor drafts file: ${result.pendingDoc}`);
  console.log(`Resume attached from ${result.resumePath}`);
  if (send) {
    console.log("Send attempted for validated queued drafts. Check Sent history.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Outreach bot failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
