"use client";

import { useState } from "react";

type Settings = {
  AUTO_SEND: boolean;
  DRY_RUN: boolean;
  MAX_EMAILS_PER_DAY: number;
  PROFESSOR_COOLDOWN_DAYS: number;
  MIN_RELEVANCE_SCORE: number;
  AUTOPILOT_MIN_SCORE: number;
  AVAILABILITY_SENTENCE: string;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Save failed");
      return;
    }
    setForm(data.settings);
    setMessage("Saved. Autopilot still requires every quality gate to pass.");
  }

  return (
    <form onSubmit={save} className="rr-card p-5 space-y-4">
      <h2 className="font-semibold">Sending controls</h2>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.DRY_RUN}
          onChange={(event) => setForm({ ...form, DRY_RUN: event.target.checked })}
        />
        DRY_RUN (do everything except Gmail send)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.AUTO_SEND}
          onChange={(event) => setForm({ ...form, AUTO_SEND: event.target.checked })}
        />
        Enable Autopilot (off by default; threshold {form.AUTOPILOT_MIN_SCORE})
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Max emails per day
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            value={form.MAX_EMAILS_PER_DAY}
            onChange={(event) => setForm({ ...form, MAX_EMAILS_PER_DAY: Number(event.target.value) })}
          />
        </label>
        <label className="text-sm">
          Cooldown days
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            value={form.PROFESSOR_COOLDOWN_DAYS}
            onChange={(event) => setForm({ ...form, PROFESSOR_COOLDOWN_DAYS: Number(event.target.value) })}
          />
        </label>
        <label className="text-sm">
          Minimum relevance
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            value={form.MIN_RELEVANCE_SCORE}
            onChange={(event) => setForm({ ...form, MIN_RELEVANCE_SCORE: Number(event.target.value) })}
          />
        </label>
        <label className="text-sm">
          Autopilot minimum score
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            value={form.AUTOPILOT_MIN_SCORE}
            onChange={(event) => setForm({ ...form, AUTOPILOT_MIN_SCORE: Number(event.target.value) })}
          />
        </label>
      </div>
      <label className="text-sm block">
        Confirmed availability sentence
        <textarea
          className="mt-1 min-h-20 w-full rounded-xl border border-line px-3 py-2"
          value={form.AVAILABILITY_SENTENCE}
          onChange={(event) => setForm({ ...form, AVAILABILITY_SENTENCE: event.target.value })}
        />
      </label>
      <p className="text-sm text-muted">
        Emails must use this sentence. Change it when your availability changes, then regenerate drafts.
      </p>
      <button className="rr-btn rr-btn-primary" type="submit">Save settings</button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </form>
  );
}
