import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_PROFESSORS_PER_COLLEGE } from "@/lib/bot/config";
import type { OutreachPackage } from "@/lib/bot/packages";
import { normalizeEmail } from "@/lib/security/email";

export type OutreachLedger = {
  nextCollegeIndex: number;
  seenEmails: string[];
  seenKeys: string[];
  perCollege: Record<string, number>;
};

const EMPTY_LEDGER: OutreachLedger = {
  nextCollegeIndex: 0,
  seenEmails: [],
  seenKeys: [],
  perCollege: {},
};

export function professorKey(email: string, name: string, college: string) {
  return `${normalizeEmail(email)}|${name.trim().toLowerCase()}|${college.trim().toLowerCase()}`;
}

export function parseSeenFromDocText(text: string) {
  const emails = new Set<string>();
  const keys = new Set<string>();
  const perCollege: Record<string, number> = {};
  const blocks = text.split(/\n{2,}/);
  for (const block of blocks) {
    const email =
      block.match(/professor'?s email:\s*(\S+)/i)?.[1] ??
      block.match(/professor email:\s*(\S+)/i)?.[1] ??
      null;
    const name = block.match(/professor name:\s*(.+)/i)?.[1]?.trim() ?? "";
    const college =
      block.match(/professor college:\s*(.+)/i)?.[1]?.trim() ??
      block.match(/^college:\s*(.+)/im)?.[1]?.trim() ??
      "";
    if (!email || !email.includes("@")) continue;
    const normalized = normalizeEmail(email);
    emails.add(normalized);
    if (name && college) keys.add(professorKey(normalized, name, college));
    if (college) perCollege[college] = (perCollege[college] ?? 0) + 1;
  }
  return { emails, keys, perCollege };
}

export function mergeSeen(
  ledger: OutreachLedger,
  doc: ReturnType<typeof parseSeenFromDocText>,
): OutreachLedger {
  const emails = new Set([...ledger.seenEmails, ...doc.emails]);
  const keys = new Set([...ledger.seenKeys, ...doc.keys]);
  const perCollege = { ...ledger.perCollege };
  for (const [college, count] of Object.entries(doc.perCollege)) {
    perCollege[college] = Math.max(perCollege[college] ?? 0, count);
  }
  return {
    nextCollegeIndex: ledger.nextCollegeIndex,
    seenEmails: [...emails],
    seenKeys: [...keys],
    perCollege,
  };
}

export function collegeHasCapacity(ledger: OutreachLedger, college: string) {
  return (ledger.perCollege[college] ?? 0) < MAX_PROFESSORS_PER_COLLEGE;
}

export function filterNewPackages(packages: OutreachPackage[], ledger: OutreachLedger) {
  const used = new Set(ledger.seenEmails);
  const keys = new Set(ledger.seenKeys);
  const perCollege = { ...ledger.perCollege };
  const fresh: OutreachPackage[] = [];
  for (const pkg of packages) {
    const email = normalizeEmail(pkg.professorEmail);
    const key = professorKey(email, pkg.professorName, pkg.college);
    if (used.has(email) || keys.has(key)) continue;
    if ((perCollege[pkg.college] ?? 0) >= MAX_PROFESSORS_PER_COLLEGE) continue;
    used.add(email);
    keys.add(key);
    perCollege[pkg.college] = (perCollege[pkg.college] ?? 0) + 1;
    fresh.push(pkg);
  }
  return { fresh, perCollege };
}

export function recordPackages(ledger: OutreachLedger, packages: OutreachPackage[]): OutreachLedger {
  const { fresh, perCollege } = filterNewPackages(packages, ledger);
  const emails = new Set(ledger.seenEmails);
  const keys = new Set(ledger.seenKeys);
  for (const pkg of fresh) {
    const email = normalizeEmail(pkg.professorEmail);
    emails.add(email);
    keys.add(professorKey(email, pkg.professorName, pkg.college));
  }
  return {
    nextCollegeIndex: ledger.nextCollegeIndex,
    seenEmails: [...emails],
    seenKeys: [...keys],
    perCollege,
  };
}

function ledgerPath() {
  return path.join(process.cwd(), "data/outbox/ledger.json");
}

export async function loadLedger(): Promise<OutreachLedger> {
  try {
    const raw = await readFile(ledgerPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<OutreachLedger>;
    return {
      nextCollegeIndex: Number(parsed.nextCollegeIndex) || 0,
      seenEmails: Array.isArray(parsed.seenEmails) ? parsed.seenEmails : [],
      seenKeys: Array.isArray(parsed.seenKeys) ? parsed.seenKeys : [],
      perCollege: parsed.perCollege && typeof parsed.perCollege === "object" ? parsed.perCollege : {},
    };
  } catch {
    return { ...EMPTY_LEDGER, perCollege: {} };
  }
}

export async function saveLedger(ledger: OutreachLedger) {
  const dir = path.join(process.cwd(), "data/outbox");
  await mkdir(dir, { recursive: true });
  await writeFile(ledgerPath(), `${JSON.stringify(ledger, null, 2)}\n`);
}
