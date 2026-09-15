import type { SendResult } from "@/lib/email/provider";

/** A failed response is not necessarily evidence that Gmail did not accept mail. */
export function persistedSendStatus(result: SendResult) {
  if (result.ok) return result.dryRun ? "DRY_RUN" : "SENT";
  if (!result.dryRun && (result.graphStatus === "UNKNOWN" || /^5\d{2}$/.test(result.graphStatus ?? ""))) {
    return "UNKNOWN";
  }
  return "FAILED";
}

/** Unresolved submissions retain their reserved daily slot without inventing sentAt. */
export function dailySendCountWhere(start: Date) {
  return {
    dryRun: false,
    OR: [
      { status: { in: ["SENT", "ACCEPTED"] }, sentAt: { gte: start } },
      { status: { in: ["SUBMITTING", "UNKNOWN"] }, createdAt: { gte: start } },
    ],
  };
}
