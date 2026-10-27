import { Globe2, ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { connection } from "next/server";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/app/actions";
import { AppShell, DeviceIcon, EmptyState, PageHeading, userTimestamp } from "@/components/app-shell";
import { getCurrentSession, getCurrentUser } from "@/lib/security/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ revoked?: string; error?: string }>;
}) {
  return (
    <Suspense fallback={<SessionsFallback />}>
      <SessionsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SessionsContent({
  searchParams,
}: {
  searchParams: Promise<{ revoked?: string; error?: string }>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [current, { revoked, error }, sessions] = await Promise.all([
    getCurrentSession(user.id),
    searchParams,
    db.session.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
      take: 50,
      select: {
        id: true,
        browser: true,
        operatingSystem: true,
        deviceCategory: true,
        city: true,
        region: true,
        country: true,
        ipAddress: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    }),
  ]);
  const otherSessions = sessions.filter((session) => session.id !== current?.id);
  return (
    <AppShell activePath="/sessions" displayName={user.displayName} email={user.email} theme={user.theme}>
      <div className="content-wrap">
        <PageHeading eyebrow="SIGNED-IN DEVICES" title="Active sessions" description="Browsers currently signed in to your account. Revoke sessions you no longer recognize." action={otherSessions.length > 0 ? <form action={revokeOtherSessionsAction}><button className="button button-outline" type="submit">Sign out other sessions</button></form> : undefined} />
        {revoked !== undefined && <div className="notice success-notice" role="status">{Number(revoked) > 0 ? `${revoked} other session${revoked === "1" ? "" : "s"} signed out.` : "No other active sessions needed to be signed out."}</div>}
        {error && <div className="notice error-notice" role="alert">That session could not be revoked. Refresh and try again.</div>}
        <div className="history-note"><ShieldCheck size={16} /><span>Sessions expire after <strong>7 days</strong> of fixed lifetime. Last-activity values reflect the last recorded use.</span></div>
        <section className="panel records-panel">
          <div className="panel-heading"><div><h2>Signed-in sessions</h2><p>{sessions.length} active session{sessions.length === 1 ? "" : "s"}</p></div><Globe2 size={19} /></div>
          {sessions.length === 0 ? <EmptyState title="No active sessions" description="There are no active sessions. Sign in again to create one." icon={<Globe2 size={20} />} /> : (
            <div className="record-list">
              {sessions.map((session) => <article className="record-row" key={session.id}>
                <span className="record-icon"><DeviceIcon category={session.deviceCategory} /></span>
                <div className="record-main"><strong>{[session.browser, session.operatingSystem].filter(Boolean).join(" · ") || "Unknown browser"}{session.id === current?.id && <span className="current-label">This device</span>}</strong><span>{session.deviceCategory ?? "Device category unknown"} · {[session.city, session.region, session.country].filter(Boolean).join(", ") || "Location unknown"}</span><small>{session.ipAddress ? `IP ${session.ipAddress}` : "IP unavailable"} · Signed in {userTimestamp(session.createdAt, user.timezone)}</small></div>
                <div className="record-meta"><span className="record-status active">Active</span><small>Last seen {userTimestamp(session.lastSeenAt, user.timezone)}</small><small>Expires {userTimestamp(session.expiresAt, user.timezone)}</small></div>
                <form action={revokeSessionAction}><input type="hidden" name="sessionId" value={session.id} /><button className="button button-outline button-small" type="submit">{session.id === current?.id ? "Sign out" : "Revoke"}</button></form>
              </article>)}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function SessionsFallback() {
  return (
    <main className="loading-page" aria-label="Loading active sessions">
      <span className="loading-spinner" />
      <p>Loading your active sessions…</p>
    </main>
  );
}
