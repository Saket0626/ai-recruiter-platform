import { prisma } from "@/lib/db/prisma";
import { syncCursorOutreachDoc } from "@/lib/bot/cursor-doc";

async function main() {
  const result = await syncCursorOutreachDoc();
  console.log(`CURSOR_DOC ${result.count} ${result.path}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
