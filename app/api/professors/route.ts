import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const professors = await prisma.professor.findMany({
    orderBy: [{ relevanceScore: "desc" }, { updatedAt: "desc" }],
    include: { _count: { select: { evidence: true, drafts: true } } },
  });
  return NextResponse.json({ professors });
}
