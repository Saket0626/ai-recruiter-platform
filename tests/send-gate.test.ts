import { describe, expect, it } from "vitest";
import { assertDraftSendable, professorStatusAfterSend } from "@/lib/email/send-gate";

describe("send approval gate", () => {
  it("blocks queued, rejected, and validation-failed drafts from manual send", () => {
    expect(() => assertDraftSendable({ status: "QUEUED", autoSend: false })).toThrow(/approved/i);
    expect(() => assertDraftSendable({ status: "REJECTED", autoSend: false })).toThrow(/Rejected/i);
    expect(() => assertDraftSendable({ status: "VALIDATION_FAILED", autoSend: false })).toThrow(/quality gate/i);
  });

  it("allows approved drafts in review mode", () => {
    expect(() => assertDraftSendable({ status: "APPROVED", autoSend: false })).not.toThrow();
  });

  it("blocks autopilot when AUTO_SEND is false", () => {
    expect(() => assertDraftSendable({ status: "QUEUED", autopilot: true, autoSend: false })).toThrow(/Autopilot is disabled/i);
  });

  it("allows autopilot only for queued or approved drafts when enabled", () => {
    expect(() => assertDraftSendable({ status: "QUEUED", autopilot: true, autoSend: true })).not.toThrow();
    expect(() => assertDraftSendable({ status: "REJECTED", autopilot: true, autoSend: true })).toThrow(/Rejected/i);
  });

  it("does not mark professors SENT after a dry run", () => {
    expect(professorStatusAfterSend(true, true)).toBe("APPROVED");
    expect(professorStatusAfterSend(false, true)).toBe("SENT");
  });
});
