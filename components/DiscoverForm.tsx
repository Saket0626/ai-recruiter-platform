"use client";

import { useEffect, useState } from "react";
import { DEFAULT_RESEARCH_KEYWORDS } from "@/lib/config/defaults";

type Progress = {
  discovered?: number;
  researched?: number;
  qualified?: number;
  queued?: number;
  universitiesTotal?: number;
  universitiesDone?: number;
  currentUniversity?: string;
};

export function DiscoverForm() {
  const [schoolCount, setSchoolCount] = useState(100);
  const [department, setDepartment] = useState("Computer Science");
  const [interests, setInterests] = useState(DEFAULT_RESEARCH_KEYWORDS.slice(0, 8).join(", "));
  const [maxCandidates, setMaxCandidates] = useState(300);
  const [maxPerUniversity, setMaxPerUniversity] = useState(3);
  const [minScore, setMinScore] = useState(65);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    void fetch("/api/universities?preset=top100")
      .then((response) => response.json())
      .then((data) => {
        if (typeof data.top100 === "number") setSchoolCount(data.top100);
      })
      .catch(() => undefined);
  }, []);

  async function pollRun(id: string) {
    for (let i = 0; i < 2400; i += 1) {
      const response = await fetch(`/api/discover/${id}`);
      const data = await response.json();
      const run = data.run;
      if (run?.progressJson) {
        setProgress(JSON.parse(run.progressJson));
      }
      if (run?.status === "COMPLETED") {
        setMessage(`Finished ${run.currentStage}. Status: ${run.status}.`);
        return;
      }
      if (run?.status === "FAILED") {
        setMessage(run.errorMessage ?? "Discovery failed");
        return;
      }
      const current = run?.progressJson ? JSON.parse(run.progressJson).currentUniversity : "universities";
      setMessage(`Working on ${current} · ${run?.currentStage}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    setMessage("Discovery is still running in the background. Refresh Discover to check later.");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(`Starting discovery across all ${schoolCount} Top 100 universities. Emails are drafted as soon as an AI professor is found.`);
    const response = await fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preset: "top100",
        department,
        researchInterests: interests.split(",").map((item) => item.trim()).filter(Boolean),
        maxCandidates,
        maxCandidatesPerUniversity: maxPerUniversity,
        minScore,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setBusy(false);
      setMessage(data.error ?? "Discovery failed");
      return;
    }
    await pollRun(data.run.id);
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="rr-card p-6 space-y-4">
      <div className="rounded-xl border border-line bg-white px-4 py-3">
        <p className="font-medium">All Top 100 U.S. universities</p>
        <p className="mt-1 text-sm text-muted">
          Every run searches the full {schoolCount}-school catalog. The moment a faculty page shows AI, machine learning, NLP, vision, or similar research, an email is drafted and sent to Review. A full run takes a while because the crawler waits between public pages.
        </p>
      </div>
      <label className="block text-sm font-medium">
        Department
        <input
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
        />
      </label>
      <label className="block text-sm font-medium">
        Research interests
        <textarea
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          rows={3}
          value={interests}
          onChange={(event) => setInterests(event.target.value)}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium">
          Maximum candidates
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
            value={maxCandidates}
            onChange={(event) => setMaxCandidates(Number(event.target.value))}
          />
        </label>
        <label className="text-sm font-medium">
          Per university cap
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
            value={maxPerUniversity}
            onChange={(event) => setMaxPerUniversity(Number(event.target.value))}
          />
        </label>
        <label className="text-sm font-medium">
          Minimum score
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
            value={minScore}
            onChange={(event) => setMinScore(Number(event.target.value))}
          />
        </label>
      </div>
      <button className="rr-btn rr-btn-primary" disabled={busy} type="submit">
        {busy ? "Discovering…" : `Start discovery (${schoolCount} schools)`}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {progress ? (
        <p className="text-sm">
          Schools {progress.universitiesDone ?? 0}/{progress.universitiesTotal ?? schoolCount}
          {progress.currentUniversity ? ` · ${progress.currentUniversity}` : ""}
          {" "}· Discovered {progress.discovered ?? 0} · Researched {progress.researched ?? 0} · Qualified {progress.qualified ?? 0} · Queued {progress.queued ?? 0}
        </p>
      ) : null}
    </form>
  );
}
