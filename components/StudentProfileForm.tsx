"use client";

import { useState } from "react";
import type { StudentIdentityOverride } from "@/lib/resume/profile-overrides";

export function StudentProfileForm({
  parsed,
  overrides,
}: {
  parsed: {
    name: string;
    university: string;
    degree: string;
    minor: string;
    graduationDate: string;
    currentStatus: string;
  };
  overrides: StudentIdentityOverride;
}) {
  const [form, setForm] = useState({
    name: overrides.name ?? parsed.name,
    university: overrides.university ?? parsed.university,
    degree: overrides.degree ?? parsed.degree,
    minor: overrides.minor ?? parsed.minor,
    graduationDate: overrides.graduationDate ?? parsed.graduationDate,
    currentStatus: overrides.currentStatus ?? parsed.currentStatus,
  });
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentProfileOverrides: form }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Save failed");
      return;
    }
    setMessage("Saved. Emails will use these identity fields instead of guessing from the PDF.");
  }

  return (
    <form onSubmit={save} className="mt-4 space-y-3">
      <h3 className="font-semibold">Correct extracted identity</h3>
      <p className="text-sm text-muted">
        Experience and projects stay bound to the PDF. Use this only to correct name, school, degree, minor
        status, and year.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["name", "Name"],
            ["university", "University"],
            ["degree", "Degree"],
            ["minor", "Minor / status"],
            ["graduationDate", "Graduation"],
            ["currentStatus", "Current status"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-sm">
            {label}
            <input
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
              value={form[key]}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <button className="rr-btn rr-btn-primary" type="submit">
        Save profile corrections
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </form>
  );
}
