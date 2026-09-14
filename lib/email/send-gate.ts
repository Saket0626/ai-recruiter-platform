export function assertDraftSendable(input: {
  status: string;
  autopilot?: boolean;
  autoSend: boolean;
}) {
  if (input.status === "REJECTED") {
    throw new Error("Rejected drafts cannot be sent.");
  }
  if (input.status === "VALIDATION_FAILED") {
    throw new Error("This draft failed the quality gate and cannot be sent.");
  }
  if (input.autopilot) {
    if (!input.autoSend) {
      throw new Error("Autopilot is disabled. Approve and send from Review Mode.");
    }
    if (!["QUEUED", "APPROVED"].includes(input.status)) {
      throw new Error("Autopilot can only send queued or approved drafts that already passed validation.");
    }
    return;
  }
  if (input.status !== "APPROVED") {
    throw new Error("Draft must be approved before sending.");
  }
}

export function professorStatusAfterSend(dryRun: boolean, ok: boolean) {
  if (!ok) return "FAILED";
  if (dryRun) return "APPROVED";
  return "SENT";
}

export function realContactStatuses() {
  return ["SENT", "ACCEPTED", "UNKNOWN"];
}
