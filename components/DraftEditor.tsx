"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DraftEditor({
  draftId,
  subject,
  body,
  status,
  failures,
}: {
  draftId: string;
  subject: string;
  body: string;
  status: string;
  failures: string;
}) {
  const router = useRouter();
  const [nextSubject, setSubject] = useState(subject);
  const [nextBody, setBody] = useState(body);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsedFailures = (() => {
    try {
      return JSON.parse(failures) as Array<{ code: string; message: string }>;
    } catch {
      return [];
    }
  })();

  async function act(action: string, extra?: RequestInit) {
    setBusy(true);
    const response = await fetch(`/api/queue/${draftId}?action=${action}`, { method: "POST", ...extra });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Request failed");
      return;
    }
    setMessage(action === "send" ? "Send recorded." : "Updated.");
    router.refresh();
  }

  async function save() {
    setBusy(true);
    await fetch(`/api/queue/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: nextSubject, body: nextBody }),
    });
    setBusy(false);
    setMessage("Saved edits.");
    router.refresh();
  }

  return (
    <section className="rr-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Generated email</h2>
        <span className="text-xs uppercase tracking-wide text-muted">{status}</span>
      </div>
      {parsedFailures.length ? (
        <ul className="rounded-xl bg-[#fff1f2] p-3 text-sm text-[#9f1239]">
          {parsedFailures.map((item) => (
            <li key={item.code}>{item.message}</li>
          ))}
        </ul>
      ) : null}
      <input
        className="w-full rounded-xl border border-line px-3 py-2"
        value={nextSubject}
        onChange={(event) => setSubject(event.target.value)}
      />
      <textarea
        className="min-h-64 w-full rounded-xl border border-line px-3 py-2 leading-6"
        value={nextBody}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button className="rr-btn rr-btn-ghost" type="button" disabled={busy} onClick={save}>Save edits</button>
        <button className="rr-btn rr-btn-ghost" type="button" disabled={busy} onClick={() => act("regenerate")}>Regenerate</button>
        <button className="rr-btn rr-btn-ghost" type="button" disabled={busy} onClick={() => act("approve")}>Approve</button>
        <button className="rr-btn rr-btn-danger" type="button" disabled={busy} onClick={() => act("reject")}>Reject</button>
        <button
          className="rr-btn rr-btn-primary"
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirm("Send this email through Gmail with the resume attached?")) act("send");
          }}
        >
          Send
        </button>
      </div>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </section>
  );
}
