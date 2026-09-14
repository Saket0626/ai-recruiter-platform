-- Prevent concurrent live send reservations for the same draft.
-- DRY_RUN and FAILED rows are excluded so a later live send can still proceed
-- after a dry-run preview, while UNKNOWN/SUBMITTING/SENT cannot be retried blindly.
CREATE UNIQUE INDEX "EmailSend_draftId_inflight_key"
ON "EmailSend" ("draftId")
WHERE status IN ('SUBMITTING', 'SENT', 'ACCEPTED', 'UNKNOWN');
