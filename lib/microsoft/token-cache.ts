import type { ICachePlugin, TokenCacheContext } from "@azure/msal-node";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";

export function createPrismaCachePlugin(): ICachePlugin {
  return {
    async beforeCacheAccess(context: TokenCacheContext) {
      const row = await prisma.authAccount.findUnique({ where: { id: "default" } });
      if (row?.tokenCache) {
        try {
          context.tokenCache.deserialize(decryptSecret(row.tokenCache));
        } catch {
          context.tokenCache.deserialize("");
        }
      }
    },
    async afterCacheAccess(context: TokenCacheContext) {
      if (!context.cacheHasChanged) return;
      const serialized = context.tokenCache.serialize();
      await prisma.authAccount.upsert({
        where: { id: "default" },
        create: { id: "default", tokenCache: encryptSecret(serialized) },
        update: { tokenCache: encryptSecret(serialized) },
      });
    },
  };
}
