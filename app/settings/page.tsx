import { getAppSettings } from "@/lib/db/settings";
import { isMicrosoftConfigured } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import { loadStudentProfile } from "@/lib/resume/service";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const [settings, account, resume] = await Promise.all([
    getAppSettings(),
    prisma.authAccount.findUnique({ where: { id: "default" } }),
    loadStudentProfile(),
  ]);
  const oauthError = typeof query.oauthError === "string" ? query.oauthError : null;
  const connected = query.connected === "1";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-2 text-muted">Review Mode stays on unless you explicitly enable Autopilot. DRY_RUN is the safe default.</p>
      </header>
      <section className="rr-card p-5 space-y-3">
        <h2 className="font-semibold">Outlook</h2>
        {oauthError ? <p className="text-sm text-[#9f1239]">{oauthError}</p> : null}
        {connected ? <p className="text-sm text-[#166534]">Outlook connected.</p> : null}
        <p className="text-sm text-muted">
          {account?.username ? `Signed in as ${account.username}` : isMicrosoftConfigured() ? "Not connected." : "Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to .env.local first."}
        </p>
        <div className="flex gap-2">
          <a className="rr-btn rr-btn-primary" href="/api/auth/microsoft">Connect Outlook</a>
          <form action="/api/auth/microsoft/logout" method="post">
            <button className="rr-btn rr-btn-ghost" type="submit">Disconnect</button>
          </form>
        </div>
      </section>
      <section className="rr-card p-5">
        <h2 className="font-semibold">Resume</h2>
        {resume.ok ? (
          <p className="mt-2 text-sm text-muted">Using {resume.profile.resumePath}. Claims in generated emails are checked against this PDF.</p>
        ) : (
          <p className="mt-2 text-sm text-[#9f1239]">{resume.error}</p>
        )}
      </section>
      <SettingsForm settings={settings} />
    </div>
  );
}
