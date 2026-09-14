import { getEnv } from "@/lib/config/env";
import { GmailEmailProvider } from "@/lib/email/gmail-provider";
import type { EmailProvider } from "@/lib/email/provider";

export function createEmailProvider(): EmailProvider {
  const provider = getEnv().EMAIL_PROVIDER;
  if (provider !== "gmail") {
    throw new Error("EMAIL_PROVIDER must be gmail. Outlook/Graph sending is disabled.");
  }
  return new GmailEmailProvider();
}
