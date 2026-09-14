import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function ProfessorsPage() {
  const professors = await prisma.professor.findMany({
    orderBy: [{ relevanceScore: "desc" }, { fullName: "asc" }],
  });
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Professors</h1>
        <p className="mt-2 text-muted">Every row is stored locally. Scores come from retrieved pages plus resume overlap, not departmental membership alone.</p>
      </header>
      {professors.length === 0 ? (
        <div className="rr-card p-8 text-muted">No professors yet. Run discovery first.</div>
      ) : (
        <div className="overflow-x-auto rr-card">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">University</th>
                <th className="p-3">Score</th>
                <th className="p-3">Status</th>
                <th className="p-3">Email</th>
              </tr>
            </thead>
            <tbody>
              {professors.map((professor) => (
                <tr key={professor.id} className="border-t border-line">
                  <td className="p-3">
                    <Link className="font-medium underline-offset-2 hover:underline" href={`/professors/${professor.id}`}>
                      {professor.fullName}
                    </Link>
                  </td>
                  <td className="p-3">{professor.university}</td>
                  <td className="p-3">{professor.relevanceScore ?? "—"}</td>
                  <td className="p-3">{professor.status}</td>
                  <td className="p-3">{professor.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
