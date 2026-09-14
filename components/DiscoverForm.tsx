"use client";

import { useMemo, useState } from "react";
import { UniversityPicker, type UniversityOption } from "@/components/UniversityPicker";
import { DEFAULT_RESEARCH_KEYWORDS } from "@/lib/config/defaults";

const DEFAULT_UNI: UniversityOption = {
  name: "University of Texas at Dallas",
  shortName: "UT Dallas",
  domain: "utdallas.edu",
  departments: ["Computer Science", "Information Systems", "Computer Engineering"],
  facultyDirectories: ["https://cs.utdallas.edu/people/faculty/", "https://jindal.utdallas.edu/faculty/"],
};

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
  const [universities, setUniversities] = useState<UniversityOption[]>([DEFAULT_UNI]);
  const [department, setDepartment] = useState("Computer Science");
  const [seedUrls, setSeedUrls] = useState(DEFAULT_UNI.facultyDirectories.join("\n"));
  const [interests, setInterests] = useState(DEFAULT_RESEARCH_KEYWORDS.slice(0, 8).join(", "));
  const [maxCandidates, setMaxCandidates] = useState(30);
  const [maxPerUniversity, setMaxPerUniversity] = useState(12);
  const [minScore, setMinScore] = useState(65);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  const multi = universities.length > 1;
  const seedField = useMemo(() => {
    if (universities.length === 1) return universities[0]?.facultyDirectories.join("\n") ?? "";
    return universities.flatMap((university) => university.facultyDirectories).join("\n");
  }, [universities]);

  function applyUniversities(next: UniversityOption[]) {
    setUniversities(next);
    setDepartment(next[0]?.departments[0] ?? "Computer Science");
    setSeedUrls(next.length === 1 ? (next[0]?.facultyDirectories.join("\n") ?? "") : next.flatMap((university) => university.facultyDirectories).join("\n"));
    if (next.length >= 100) {
      setMaxCandidates(120);
      setMaxPerUniversity(4);
    } else if (next.length > 1) {
      setMaxCandidates(Math.max(40, next.length * 3));
      setMaxPerUniversity(8);
    }
  }

  async function pollRun(id: string) {
    for (let i = 0; i < 600; i += 1) {
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
      setMessage(`Working on ${run?.progressJson ? JSON.parse(run.progressJson).currentUniversity : "universities"} · ${run?.currentStage}`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    setMessage("Discovery is still running. Refresh Discover to check later.");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!universities.length) {
      setMessage("Select at least one university.");
      return;
    }
    setBusy(true);
    setMessage("Starting discovery across selected universities. Public faculty pages are retrieved with crawl delays.");
    const response = await fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universities: universities.map((university) => university.name),
        university: universities[0]?.name,
        universityDomain: universities.length === 1 ? universities[0]?.domain : undefined,
        department,
        seedUrls: universities.length === 1 ? seedUrls.split(/\n+/).map((line) => line.trim()).filter(Boolean) : [],
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
      <UniversityPicker selected={universities} onChange={applyUniversities} />
      <label className="block text-sm font-medium">
        Department
        <input
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
        />
      </label>
      {universities.length === 1 ? (
        <>
          <label className="block text-sm font-medium">
            University domain
            <input className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" value={universities[0]?.domain ?? ""} readOnly />
          </label>
          <label className="block text-sm font-medium">
            Seed faculty URLs
            <textarea
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 font-mono text-sm"
              rows={4}
              value={seedUrls}
              onChange={(event) => setSeedUrls(event.target.value)}
            />
          </label>
        </>
      ) : (
        <p className="text-sm text-muted">
          Each selected school uses its catalog faculty directory. {seedField.split("\n").filter(Boolean).length} seed URLs will be crawled.
          {universities.length >= 50
            ? " A Top 100 run takes a while because the crawler waits between public pages."
            : null}
        </p>
      )}
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
            disabled={!multi && universities.length <= 1}
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
        {busy ? "Discovering…" : universities.length > 1 ? `Start discovery (${universities.length} schools)` : "Start discovery"}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {progress ? (
        <p className="text-sm">
          Schools {progress.universitiesDone ?? 0}/{progress.universitiesTotal ?? universities.length}
          {progress.currentUniversity ? ` · ${progress.currentUniversity}` : ""}
          {" "}· Discovered {progress.discovered ?? 0} · Researched {progress.researched ?? 0} · Qualified {progress.qualified ?? 0} · Queued {progress.queued ?? 0}
        </p>
      ) : null}
    </form>
  );
}
