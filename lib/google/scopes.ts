export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GOOGLE_OPENID_SCOPES = ["openid", "email"] as const;

export const GOOGLE_AUTH_SCOPES = [...GOOGLE_OPENID_SCOPES, GMAIL_SEND_SCOPE] as const;

export const FORBIDDEN_GMAIL_SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.insert",
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
] as const;

export const GMAIL_MESSAGES_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
export const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export function splitScope(scope: string) {
  return scope.split(/[ ,]+/).map((item) => item.trim()).filter(Boolean);
}

export function hasGmailSendScope(scope: string) {
  return splitScope(scope).includes(GMAIL_SEND_SCOPE);
}

export function forbiddenGmailScopes(scope: string) {
  const granted = new Set(splitScope(scope));
  return FORBIDDEN_GMAIL_SCOPES.filter((item) => granted.has(item));
}
