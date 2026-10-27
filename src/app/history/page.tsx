import { Activity, CircleAlert, ShieldCheck } from "lucide-react";
import { AppShell, EmptyState, PageHeading, userTimestamp } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/security/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

const eventNames: Record<string, string> = {
  REGISTRATION: "Account created",
  LOGIN_SUCCESS: "Successful sign-in",
  FAILED_PASSWORD: "Sign-in failed",
  OTP_REQUIRED: "Additional verification required",
  OTP_ISSUED: "Verification code sent",
  OTP_DELIVERY_FAILED: "Verification email delivery failed",
  OTP_FAILED: "Verification code rejected",
  OTP_VERIFIED: "Email verification succeeded",
  TRUST_CREATED: "Trusted device added",
  TRUST_REVOKED: "Trusted device revoked",
  SESSION_REVOKED: "Session revoked",
  PASSWORD_RATE_LIMIT: "Sign-in rate limit applied",
  OTP_RATE_LIMIT: "Verification rate limit applied",
};

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [events, count] = await Promise.all([
    db.auditEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        reason: true,
        outcome: true,
        trusted: true,
        ipAddress: true,
        browser: true,
        operatingSystem: true,
        deviceCategory: true,
        deviceModel: true,
        city: true,
        region: true,
        country: true,
        createdAt: true,
      },
    }),
    db.auditEvent.count({ where: { userId: user.id } }),
  ]);
  return (
    <AppShell activePath="/history" displayName={user.displayName} email={user.email} theme={user.theme}>
      <div className="content-wrap">
        <PageHeading eyebrow="ACCOUNT ACTIVITY" title="Login history" description="A chronological record of sign-ins and security events for your account." />
        <div className="history-note"><ShieldCheck size={16} /><span>Showing up to 50 most recent account events. Timestamps use <strong>{user.timezone}</strong>. Unknown IP or location values are left blank rather than estimated.</span></div>
        <section className="panel history-panel">
          <div className="panel-heading"><div><h2>Security events</h2><p>{count} recorded event{count === 1 ? "" : "s"} · newest first</p></div><Activity size={19} /></div>
          {events.length === 0 ? <EmptyState title="No events yet" description="There are no sign-in records for this account. Sign-in and security events will appear here as they happen." icon={<Activity size={20} />} /> : (
            <div className="history-list">
              {events.map((event) => {
                const location = [event.city, event.region, event.country].filter(Boolean).join(", ");
                const isSuccess = event.outcome === "SUCCESS";
                return (
                  <article className="history-event" key={event.id}>
                    <span className={`history-event-icon ${isSuccess ? "is-success" : event.outcome === "FAILURE" ? "is-failure" : ""}`}>{isSuccess ? <ShieldCheck size={18} /> : event.outcome === "FAILURE" ? <CircleAlert size={18} /> : <Activity size={18} />}</span>
                    <div className="history-event-main"><strong>{eventNames[event.reason] ?? "Security event"}</strong><span>{[event.browser, event.operatingSystem].filter(Boolean).join(" · ") || "Browser details unknown"}{event.deviceCategory ? ` · ${event.deviceCategory}` : ""}{event.deviceModel ? ` · ${event.deviceModel}` : ""}</span><small>{location || "Location unknown"}{event.ipAddress ? ` · ${event.ipAddress}` : " · IP unavailable"}</small></div>
                    <div className="history-event-side"><time>{userTimestamp(event.createdAt, user.timezone)}</time><span className={isSuccess ? "outcome-success" : event.outcome === "FAILURE" || event.outcome === "BLOCKED" ? "outcome-failure" : "outcome-neutral"}>{event.outcome.toLowerCase()}{event.trusted ? " · trusted" : ""}</span></div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
