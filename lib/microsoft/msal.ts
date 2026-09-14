import "server-only";
import { ConfidentialClientApplication, CryptoProvider, type AccountInfo } from "@azure/msal-node";
import { getEnv, isMicrosoftConfigured } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import { GRAPH_SCOPES } from "@/lib/microsoft/scopes";
import { createPrismaCachePlugin } from "@/lib/microsoft/token-cache";

const cryptoProvider = new CryptoProvider();

export function getMsalClient() {
  const env = getEnv();
  if (!isMicrosoftConfigured()) {
    throw new Error("Microsoft Entra is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.");
  }
  return new ConfidentialClientApplication({
    auth: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID || "common"}`,
    },
    cache: { cachePlugin: createPrismaCachePlugin() },
  });
}

export async function createAuthCodeUrl(state: string, nonce: string) {
  const env = getEnv();
  const client = getMsalClient();
  return client.getAuthCodeUrl({
    scopes: [...GRAPH_SCOPES],
    redirectUri: env.MICROSOFT_REDIRECT_URI,
    state,
    nonce,
    prompt: "select_account",
  });
}

export async function redeemAuthCode(code: string) {
  const env = getEnv();
  const client = getMsalClient();
  const result = await client.acquireTokenByCode({
    code,
    scopes: [...GRAPH_SCOPES],
    redirectUri: env.MICROSOFT_REDIRECT_URI,
  });
  if (!result?.account) throw new Error("Microsoft sign-in did not return an account.");
  await prisma.authAccount.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      homeAccountId: result.account.homeAccountId,
      username: result.account.username,
      name: result.account.name,
    },
    update: {
      homeAccountId: result.account.homeAccountId,
      username: result.account.username,
      name: result.account.name,
    },
  });
  return result.account;
}

export async function getSavedAccount(): Promise<AccountInfo | null> {
  const row = await prisma.authAccount.findUnique({ where: { id: "default" } });
  if (!row?.homeAccountId) return null;
  const client = getMsalClient();
  return (await client.getTokenCache().getAccountByHomeId(row.homeAccountId)) ?? null;
}

export async function acquireGraphToken() {
  const account = await getSavedAccount();
  if (!account) throw new Error("Outlook is not connected.");
  const client = getMsalClient();
  const result = await client.acquireTokenSilent({
    account,
    scopes: [...GRAPH_SCOPES],
  });
  if (!result?.accessToken) throw new Error("Could not acquire a Microsoft Graph token. Connect Outlook again.");
  return result.accessToken;
}

export async function clearMicrosoftAccount() {
  await prisma.authAccount.upsert({
    where: { id: "default" },
    create: { id: "default", homeAccountId: null, username: null, name: null, tokenCache: "" },
    update: { homeAccountId: null, username: null, name: null, tokenCache: "" },
  });
}

export { cryptoProvider };
