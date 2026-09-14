import { NextResponse } from "next/server";
import {
  getTop100Universities,
  getTopCsUniversities,
  searchUniversities,
  UNIVERSITIES,
} from "@/lib/universities/catalog";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const preset = searchParams.get("preset");
  const results =
    preset === "top100"
      ? getTop100Universities()
      : preset === "top-cs"
        ? getTopCsUniversities()
        : q
          ? searchUniversities(q, 25)
          : UNIVERSITIES.slice(0, 30);
  return NextResponse.json({
    count: UNIVERSITIES.length,
    top100: getTop100Universities().length,
    results,
  });
}
