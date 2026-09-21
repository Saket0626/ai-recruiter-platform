import { ASU_WORST_RANK, COLLEGES_PER_RUN, PREFERRED_COLLEGES, TEXAS_COLLEGES } from "@/lib/bot/config";
import { collegeHasCapacity, type OutreachLedger } from "@/lib/bot/ledger";
import { UNIVERSITIES, getTop100Universities, type University } from "@/lib/universities/catalog";

function asuOrBetter(university: University) {
  if (PREFERRED_COLLEGES.includes(university.name)) return true;
  return typeof university.nationalRank === "number" && university.nationalRank <= ASU_WORST_RANK;
}

export function rotationColleges() {
  const preferred = PREFERRED_COLLEGES.map((name) => UNIVERSITIES.find((university) => university.name === name)).filter(
    (university): university is University => Boolean(university),
  );
  const rest = getTop100Universities().filter(
    (university) => asuOrBetter(university) && !PREFERRED_COLLEGES.includes(university.name),
  );
  return [...preferred, ...rest];
}

export function texasRotationColleges() {
  return TEXAS_COLLEGES.map((name) => UNIVERSITIES.find((university) => university.name === name)).filter(
    (university): university is University => Boolean(university),
  );
}

export function pickNextColleges(
  ledger: OutreachLedger,
  count = COLLEGES_PER_RUN,
  options?: { catalog?: University[]; startIndex?: number; requireCapacity?: boolean },
) {
  const catalog = options?.catalog ?? rotationColleges();
  if (!catalog.length) return { colleges: [] as string[], nextCollegeIndex: 0 };
  const picked: string[] = [];
  const requireCapacity = options?.requireCapacity ?? true;
  let index = (options?.startIndex ?? ledger.nextCollegeIndex) % catalog.length;
  let scanned = 0;
  while (picked.length < count && scanned < catalog.length) {
    const university = catalog[index]!;
    if (!requireCapacity || collegeHasCapacity(ledger, university.name)) {
      picked.push(university.name);
    }
    index = (index + 1) % catalog.length;
    scanned += 1;
  }
  return { colleges: picked, nextCollegeIndex: index };
}
