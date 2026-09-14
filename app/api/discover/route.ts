import { after, NextResponse } from "next/server";
import { discoveryInputSchema } from "@/lib/validation/schemas";
import { executeDiscovery, startDiscoveryRun } from "@/lib/research/pipeline";
import { publicError } from "@/lib/security/errors";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logging/logger";

export const maxDuration = 800;

export async function GET() {
  const runs = await prisma.discoveryRun.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = discoveryInputSchema.parse(body);
    const run = await startDiscoveryRun(input);
    after(async () => {
      try {
        await executeDiscovery(run.id);
      } catch (error) {
        logger.error("discovery_background_failed", {
          runId: run.id,
          error: error instanceof Error ? error.message : "Discovery failed",
        });
      }
    });
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
}
