"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function UnlockForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("reason") === "missing-secret"
      ? "Set APP_ACCESS_SECRET on the host, then unlock. Production refuses anonymous access."
      : null,
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/auth/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Unlock failed");
      return;
    }
    router.replace(params.get("next") || "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rr-card mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Unlock ResearchReach</h1>
      <p className="text-sm text-muted">
        Enter the app access secret from the host environment. This is not your Gmail password.
      </p>
      <input
        type="password"
        className="w-full rounded-xl border border-line px-3 py-2"
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        autoComplete="current-password"
      />
      <button className="rr-btn rr-btn-primary" type="submit">Unlock</button>
      {error ? <p className="text-sm text-[#9f1239]">{error}</p> : null}
    </form>
  );
}
