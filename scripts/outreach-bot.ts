import { prisma } from "@/lib/db/prisma";
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
  const maxCandidates = numberFlag("--max", 300);
  const result = await runOutreachBot({ send, reportOnly, maxCandidates });
  console.log(printOutreachPackages(result.packages));
  console.log(`\nWrote ${result.packages.length} packages to ${result.outbox}`);
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
