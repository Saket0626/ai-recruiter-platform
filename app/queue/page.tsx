import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { DraftEditor } from "@/components/DraftEditor";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const drafts = await prisma.emailDraft.findMany({
    where: { status: { in: ["QUEUED", "APPROVED", "VALIDATION_FAILED"] } },
    include: { professor: { include: { evidence: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Review queue</h1>
        <p className="mt-2 text-muted">Read the evidence beside each draft before approving. Review Mode is the default.</p>
      </header>
      {drafts.length === 0 ? <div className="rr-card p-8 text-muted">Nothing waiting for review.</div> : drafts.map((draft) => {
        const topics = JSON.parse(draft.professor.researchTopics || "[]") as string[];
        return (
          <article key={draft.id} className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <DraftEditor
              draftId={draft.id}
              subject={draft.subject}
              body={draft.body}
              status={draft.status}
              failures={draft.validationErrors}
            />
            <aside className="rr-card p-5 space-y-3">
              <h2 className="font-semibold">
                <Link href={`/professors/${draft.professor.id}`}>{draft.professor.fullName}</Link>
              </h2>
              <p className="text-sm text-muted">{draft.professor.university} · score {draft.professor.relevanceScore}</p>
              <p className="text-sm">{draft.professor.relevanceExplanation}</p>
              <p className="text-sm"><span className="text-muted">Topics:</span> {topics.join(", ")}</p>
              <ul className="space-y-2 text-sm">
                {draft.professor.evidence.map((item) => (
                  <li key={item.id}>
                    <a className="text-copper" href={item.url} target="_blank" rel="noreferrer">{item.title || item.url}</a>
                  </li>
                ))}
              </ul>
            </aside>
          </article>
        );
      })}
    </div>
  );
}
