export function stableFactId(kind: "exp" | "proj", name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${kind}:${slug || "item"}`;
}

export function factExcerpt(summary: string) {
  return summary.replace(/\s+/g, " ").trim().slice(0, 400);
}
