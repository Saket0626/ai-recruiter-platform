import { DiscoverForm } from "@/components/DiscoverForm";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const runs = await prisma.discoveryRun.findMany({ orderBy: { createdAt: "desc" }, take: 8 });
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="text-sm uppercase tracking-[0.18em] text-muted">Discovery</p>
        <h1 className="mt-1 text-3xl font-semibold">Find professors</h1>
        <p className="mt-2 text-muted">
          Every discovery run searches all Top 100 U.S. universities. As soon as a professor page shows AI research, ResearchReach drafts an email and puts it in Review. Each school is crawled from its own public faculty directory and <code>site:domain</code> queries.
        </p>
      </header>
      <DiscoverForm />
      <section className="rr-card p-5">
        <h2 className="font-semibold">Recent runs</h2>
        {runs.length === 0 ? <p className="mt-2 text-sm text-muted">No discovery runs yet.</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {runs.map((run) => (
              <li key={run.id} className="rounded-xl border border-line px-3 py-2">
                <strong>{run.university}</strong> · {run.department} · {run.currentStage} · {run.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
