"use client";

import { useEffect, useMemo, useState } from "react";

export type UniversityOption = {
  name: string;
  shortName: string;
  domain: string;
  departments: string[];
  facultyDirectories: string[];
  nationalRank?: number | null;
  inTop100?: boolean;
};

export function UniversityPicker({
  selected,
  onChange,
}: {
  selected: UniversityOption[];
  onChange: (universities: UniversityOption[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<UniversityOption[]>([]);
  const [count, setCount] = useState(0);
  const [top100Count, setTop100Count] = useState(100);

  useEffect(() => {
    const handle = setTimeout(async () => {
      const response = await fetch(`/api/universities?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setResults(data.results ?? []);
      setCount(data.count ?? 0);
      setTop100Count(data.top100 ?? 100);
    }, 150);
    return () => clearTimeout(handle);
  }, [query]);

  const selectedDomains = useMemo(() => new Set(selected.map((university) => university.domain)), [selected]);

  async function applyPreset(preset: "top100" | "top-cs") {
    const response = await fetch(`/api/universities?preset=${preset}`);
    const data = await response.json();
    onChange(data.results ?? []);
    setOpen(false);
  }

  function addUniversity(university: UniversityOption) {
    if (selectedDomains.has(university.domain)) return;
    onChange([...selected, university]);
    setQuery("");
    setOpen(false);
  }

  function removeUniversity(domain: string) {
    onChange(selected.filter((university) => university.domain !== domain));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rr-btn rr-btn-primary" onClick={() => applyPreset("top100")}>
          Top 100 U.S. universities
        </button>
        <button type="button" className="rr-btn rr-btn-ghost" onClick={() => applyPreset("top-cs")}>
          Top CS programs
        </button>
        <button type="button" className="rr-btn rr-btn-ghost" onClick={() => onChange([])}>
          Clear
        </button>
      </div>
      <div className="relative">
        <label className="text-sm font-medium">Add universities</label>
        <input
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search MIT, Stanford, Michigan, Georgia Tech…"
        />
        <p className="mt-1 text-xs text-muted">
          Catalog: {count} schools · Top 100 preset: {top100Count} national universities. Research is not limited to UT Dallas.
        </p>
        {open && results.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-white shadow-lg">
            {results.map((university) => (
              <li key={university.domain + university.name}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-[#f6efe4] disabled:opacity-50"
                  disabled={selectedDomains.has(university.domain)}
                  onClick={() => addUniversity(university)}
                >
                  <span className="font-medium">{university.name}</span>
                  <span className="ml-2 text-xs text-muted">
                    {university.shortName} · {university.domain}
                    {university.nationalRank ? ` · #${university.nationalRank}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div>
        <p className="text-sm font-medium">{selected.length} selected</p>
        {selected.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Select at least one university, or use the Top 100 preset.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {selected.map((university) => (
              <li key={university.domain} className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-sm">
                <span>
                  {university.shortName}
                  {university.nationalRank ? ` #${university.nationalRank}` : ""}
                </span>
                <button type="button" className="text-muted" onClick={() => removeUniversity(university.domain)} aria-label={`Remove ${university.name}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
