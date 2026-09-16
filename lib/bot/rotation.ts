import { AUTOMATION_UNIVERSITIES, COLLEGES_PER_RUN } from "@/lib/bot/config";
import { collegeHasCapacity, type OutreachLedger } from "@/lib/bot/ledger";
import { UNIVERSITIES, type University } from "@/lib/universities/catalog";

export function rotationColleges() {
  return AUTOMATION_UNIVERSITIES.map((name) =>
    UNIVERSITIES.find((university) => university.name === name),
  ).filter((university): university is University => Boolean(university));
}

export function pickNextColleges(ledger: OutreachLedger, count = COLLEGES_PER_RUN) {
  const catalog = rotationColleges();
  if (!catalog.length) return { colleges: [] as string[], nextCollegeIndex: 0 };
  const picked: string[] = [];
  let index = ledger.nextCollegeIndex % catalog.length;
  let scanned = 0;
  while (picked.length < count && scanned < catalog.length) {
    const university = catalog[index]!;
    if (collegeHasCapacity(ledger, university.name)) {
      picked.push(university.name);
    }
    index = (index + 1) % catalog.length;
    scanned += 1;
  }
  return { colleges: picked, nextCollegeIndex: index };
}
