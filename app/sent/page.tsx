import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function SentPage() {
  const sends = await prisma.emailSend.findMany({
    include: { professor: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Sent</h1>
        <p className="mt-2 text-muted">Local send history, including DRY_RUN previews. Duplicate sends are blocked by cooldown.</p>
      </header>
      {sends.length === 0 ? <div className="rr-card p-8 text-muted">No sends yet.</div> : (
        <div className="overflow-x-auto rr-card">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Professor</th>
                <th className="p-3">Recipient</th>
                <th className="p-3">Status</th>
                <th className="p-3">Graph</th>
              </tr>
            </thead>
            <tbody>
              {sends.map((send) => (
                <tr key={send.id} className="border-t border-line align-top">
                  <td className="p-3">{send.sentAt?.toLocaleString() ?? send.createdAt.toLocaleString()}</td>
                  <td className="p-3">{send.professor.fullName}</td>
                  <td className="p-3">{send.recipient}</td>
                  <td className="p-3">{send.status}{send.dryRun ? " (dry run)" : ""}</td>
                  <td className="p-3">{send.graphStatus ?? send.failureReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
