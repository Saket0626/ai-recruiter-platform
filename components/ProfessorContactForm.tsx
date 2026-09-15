"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfessorContactForm({
  professorId,
  email,
  allowGenericInbox,
}: {
  professorId: string;
  email: string | null;
  allowGenericInbox: boolean;
}) {
  const router = useRouter();
  const [nextEmail, setNextEmail] = useState(email ?? "");
  const [allowGeneric, setAllowGeneric] = useState(allowGenericInbox);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch(`/api/professors/${professorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(nextEmail.trim() ? { email: nextEmail.trim() } : {}),
        allowGenericInbox: allowGeneric,
      }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Save failed");
      return;
    }
    setMessage(
      allowGeneric
        ? "Saved. Autopilot still will not send to a generic inbox."
        : "Saved. Generic inboxes stay blocked until you check the override.",
    );
    router.refresh();
  }

  return (
    <form onSubmit={save} className="rr-card p-5 space-y-3">
      <h2 className="font-semibold">Contact</h2>
      <label className="text-sm block">
        Faculty email
        <input
          type="email"
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={nextEmail}
          onChange={(event) => setNextEmail(event.target.value)}
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={allowGeneric}
          onChange={(event) => setAllowGeneric(event.target.checked)}
        />
        <span>
          Manually allow sending to this address even if it looks like a department inbox. Review Mode only.
          Autopilot can never use this exception.
        </span>
      </label>
      <button className="rr-btn rr-btn-primary" disabled={busy} type="submit">
        Save contact
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </form>
  );
}
