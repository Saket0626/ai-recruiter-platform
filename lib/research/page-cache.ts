import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";

export async function getCachedPage(url: string) {
  const row = await prisma.pageCache.findUnique({ where: { url } });
  if (!row) return null;
  const ageMs = Date.now() - row.fetchedAt.getTime();
  if (ageMs > 1000 * 60 * 60 * 24 * 14) return null;
  return row;
}

export async function putCachedPage(input: {
  url: string;
  body: string;
  statusCode: number;
  contentType?: string | null;
}) {
  return prisma.pageCache.upsert({
    where: { url: input.url },
    create: {
      url: input.url,
      body: input.body,
      statusCode: input.statusCode,
      contentType: input.contentType ?? "text/html",
    },
    update: {
      body: input.body,
      statusCode: input.statusCode,
      contentType: input.contentType ?? "text/html",
      fetchedAt: new Date(),
    },
  });
}

export function crawlDelay() {
  return getEnv().CRAWL_DELAY_MS;
}
