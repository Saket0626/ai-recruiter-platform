import { getAppSettings } from "@/lib/db/settings";
import { getGoogleConnectionView } from "@/lib/google/oauth";
import { loadStudentProfile } from "@/lib/resume/service";
import { ResumeProfile } from "@/components/ResumeProfile";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const [settings, resume, google] = await Promise.all([
    getAppSettings(),
    loadStudentProfile(),
    getGoogleConnectionView(),
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
        <h2 className="font-semibold">Gmail</h2>
        {oauthError ? <p className="text-sm text-[#9f1239]">{oauthError}</p> : null}
        {connected ? <p className="text-sm text-[#166534]">Gmail connected as {google.email}.</p> : null}
        <p className="text-sm text-muted">
          Allowed sender: {google.allowedEmail}. Connecting Gmail does not send a test email.
        </p>
        {google.configured ? (
          <p className="text-sm text-muted">
            {google.connected
              ? `Signed in as ${google.email}. Send scope: ${google.hasSendScope ? "gmail.send granted" : "missing"}`
              : "Not connected."}
          </p>
        ) : (
          <p className="text-sm text-[#9f1239]">
            Missing {google.missing.join(", ")} in server environment. Add them locally or on the host; do not paste secrets into chat.
          </p>
        )}
        {google.reconnectReason ? <p className="text-sm text-[#9f1239]">{google.reconnectReason}</p> : null}
        <p className="text-sm text-muted">Redirect URI in use: {google.redirectUri}</p>
        <p className="text-sm text-muted">{google.testingRefreshNote}</p>
        <div className="flex gap-2">
          <a className="rr-btn rr-btn-primary" href="/api/auth/google">
            Connect Gmail
          </a>
          <form action="/api/auth/google/logout" method="post">
            <button className="rr-btn rr-btn-ghost" type="submit">
              Disconnect
            </button>
          </form>
        </div>
      </section>
      <section className="rr-card p-5">
        <h2 className="font-semibold">Resume</h2>
        {resume.ok ? (
          <>
            <p className="mt-2 text-sm text-muted">Using {resume.profile.resumePath}. Outbound emails attach this PDF.</p>
            <ResumeProfile profile={resume.profile} />
          </>
        ) : (
          <p className="mt-2 text-sm text-[#9f1239]">{resume.error}</p>
        )}
      </section>
      <SettingsForm settings={settings} />
    </div>
  );
}
