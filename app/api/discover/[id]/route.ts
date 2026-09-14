import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const run = await prisma.discoveryRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "Discovery run not found" }, { status: 404 });
  return NextResponse.json({ run });
}
