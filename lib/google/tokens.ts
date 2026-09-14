import { decryptSecret, encryptSecret } from "@/lib/security/secrets";

export type GoogleTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  scope?: string;
  tokenType?: string;
  idToken?: string;
};

export function mergeGoogleTokens(existing: GoogleTokenSet | null, incoming: GoogleTokenSet): GoogleTokenSet {
  return {
    accessToken: incoming.accessToken,
    refreshToken: incoming.refreshToken || existing?.refreshToken,
    expiryDate: incoming.expiryDate ?? existing?.expiryDate,
    scope: incoming.scope || existing?.scope,
    tokenType: incoming.tokenType || existing?.tokenType,
    idToken: incoming.idToken || existing?.idToken,
  };
}

export function encryptGoogleTokens(tokens: GoogleTokenSet) {
  return encryptSecret(JSON.stringify(tokens));
}

export function decryptGoogleTokens(payload: string): GoogleTokenSet {
  const parsed = JSON.parse(decryptSecret(payload)) as GoogleTokenSet;
  if (!parsed?.accessToken) throw new Error("Stored Google tokens are unreadable. Reconnect Gmail.");
  return parsed;
}
