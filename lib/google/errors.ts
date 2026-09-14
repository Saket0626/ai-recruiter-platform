export function googleCallbackErrorMessage(error: string, description?: string | null) {
  if (error === "access_denied") {
    return "Google sign-in was denied. The saved Gmail account was not changed.";
  }
  return description?.slice(0, 180) || error;
}

export function googleRefreshErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/invalid_grant|expired|revoked/i.test(message)) {
    return "Google refresh token expired or was revoked. Testing Gmail apps often expire refresh tokens after 7 days. Reconnect Gmail.";
  }
  return "Could not refresh the Gmail access token. Reconnect Gmail.";
}
