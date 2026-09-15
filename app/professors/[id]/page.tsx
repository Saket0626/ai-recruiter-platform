import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { DraftEditor } from "@/components/DraftEditor";
import { ProfessorContactForm } from "@/components/ProfessorContactForm";

export const dynamic = "force-dynamic";

export default async function ProfessorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const professor = await prisma.professor.findUnique({
    where: { id },
    include: { evidence: true, drafts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!professor) notFound();
  const topics = JSON.parse(professor.researchTopics || "[]") as string[];
  const factors = JSON.parse(professor.scoringFactors || "{}") as Record<string, number>;
  const draft = professor.drafts[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm text-muted">{professor.university} · {professor.department}</p>
        <h1 className="text-3xl font-semibold">{professor.fullName}</h1>
        <p className="mt-1 text-muted">{professor.title} {professor.email ? `· ${professor.email}` : ""}</p>
      </header>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rr-card p-5 space-y-3">
            <h2 className="font-semibold">Relevance</h2>
            <p className="text-4xl font-semibold">{professor.relevanceScore ?? "—"}</p>
            <p className="text-sm">{professor.relevanceExplanation}</p>
            <p className="text-xs text-muted">
              AI {factors.ai ?? 0} · Systems {factors.systems ?? 0} · Resume {factors.resumeOverlap ?? 0} · Activity {factors.activity ?? 0}
            </p>
            <p className="text-sm"><span className="text-muted">Topics:</span> {topics.join(", ") || "None extracted"}</p>
            <p className="text-sm"><span className="text-muted">Status:</span> {professor.status}</p>
          </div>
          <ProfessorContactForm
            professorId={professor.id}
            email={professor.email}
            allowGenericInbox={professor.allowGenericInbox}
          />
        </div>
        <div className="rr-card p-5 space-y-2">
          <h2 className="font-semibold">Evidence</h2>
          {professor.evidence.length === 0 ? <p className="text-sm text-muted">No pages stored.</p> : professor.evidence.map((item) => (
            <article key={item.id} className="rounded-xl border border-line p-3">
              <a className="text-sm font-medium text-copper" href={item.url} target="_blank" rel="noreferrer">
                {item.title || item.url}
              </a>
              <p className="mt-1 text-xs text-muted">{item.claim}</p>
              <p className="mt-2 text-sm line-clamp-6">{item.extractedText.slice(0, 500)}</p>
            </article>
          ))}
        </div>
      </section>
      {draft ? <DraftEditor draftId={draft.id} subject={draft.subject} body={draft.body} status={draft.status} failures={draft.validationErrors} /> : (
        <div className="rr-card p-5 text-sm text-muted">No email was generated. Insufficient evidence or the quality gate blocked it.</div>
      )}
    </div>
  );
}
