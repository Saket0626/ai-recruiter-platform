import { COLLEGES_PER_RUN, PREFERRED_COLLEGES } from "@/lib/bot/config";
import { collegeHasCapacity, type OutreachLedger } from "@/lib/bot/ledger";
import { getTop100Universities } from "@/lib/universities/catalog";

export function rotationColleges() {
  const all = getTop100Universities();
  const preferred = PREFERRED_COLLEGES.map((name) => all.find((university) => university.name === name)).filter(
    (university): university is NonNullable<typeof university> => Boolean(university),
  );
  const rest = all.filter((university) => !PREFERRED_COLLEGES.includes(university.name));
  return [...preferred, ...rest];
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
