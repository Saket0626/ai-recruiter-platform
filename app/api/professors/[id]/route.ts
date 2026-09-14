import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const professor = await prisma.professor.findUnique({
    where: { id },
    include: { evidence: true, drafts: { orderBy: { createdAt: "desc" } }, sends: true },
  });
  if (!professor) return NextResponse.json({ error: "Professor not found" }, { status: 404 });
  return NextResponse.json({ professor });
}
