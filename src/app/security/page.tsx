import { KeyRound, LockKeyhole, ShieldCheck, ShieldEllipsis, TimerReset } from "lucide-react";
import { AppShell, PageHeading, SecurityCard, StatusPill } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/security/auth";
import { isOtpDeliveryConfigured } from "@/lib/security/email";
import { configuredPositiveInteger } from "@/lib/security/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [devices, sessions, lastOtp] = await Promise.all([
    db.trustedDevice.count({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
    db.session.count({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
    db.auditEvent.findFirst({
      where: { userId: user.id, reason: "OTP_VERIFIED" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return (
    <AppShell activePath="/security" displayName={user.displayName} email={user.email} theme={user.theme}>
      <div className="content-wrap">
        <PageHeading eyebrow="ACCOUNT PROTECTION" title="Account security" description="The controls and checks currently protecting your SentinelID account." action={<StatusPill>Protection active</StatusPill>} />
        <section className="metrics-grid security-metrics">
          <SecurityCard title="Email verification" value={isOtpDeliveryConfigured() ? "Ready" : "Setup needed"} note={isOtpDeliveryConfigured() ? "Risk-aware verification delivery configured" : "Configure an email provider to verify new sign-ins"} icon={<ShieldCheck size={18} />} />
          <SecurityCard title="Password storage" value="Argon2id" note="One-way password hashing" icon={<KeyRound size={18} />} tone="blue" />
          <SecurityCard title="Trusted devices" value={String(devices)} note="Active device approvals" icon={<LockKeyhole size={18} />} tone="violet" />
        </section>
        <section className="panel security-detail-panel">
          <div className="panel-heading"><div><h2>Sign-in verification</h2><p>Additional verification is requested when a sign-in looks unfamiliar.</p></div><span className="detail-icon"><ShieldEllipsis size={19} /></span></div>
          <div className="security-checklist">
            <div><span className="checkmark"><ShieldCheck size={16} /></span><span><strong>New or changed browser and device</strong><small>Recognized using the revocable trusted-device cookie and stored device metadata.</small></span><span className="enabled-label">Enabled</span></div>
            <div><span className="checkmark"><ShieldCheck size={16} /></span><span><strong>Changed public IP address</strong><small>Compared only when the server is configured to trust its deployment proxy.</small></span><span className="enabled-label">Enabled</span></div>
            <div><span className="checkmark"><ShieldCheck size={16} /></span><span><strong>Changed location or expired trust</strong><small>Location checks run only when a geolocation provider returns city and region.</small></span><span className="enabled-label">Enabled</span></div>
          </div>
        </section>
        <section className="dashboard-grid security-lower-grid">
          <article className="panel detail-panel"><div className="panel-heading"><div><h2>Session lifetime</h2><p>Authentication sessions expire automatically.</p></div><TimerReset size={19} /></div><div className="big-stat">7 <span>days</span></div><p className="fine-print">Sign out any session at any time from the Active sessions page. Revoked sessions are no longer accepted.</p><div className="detail-bottom"><span>Current active sessions</span><strong>{sessions}</strong></div></article>
          <article className="panel detail-panel"><div className="panel-heading"><div><h2>Verification history</h2><p>Recent email verification check</p></div><ShieldCheck size={19} /></div>{lastOtp ? <><div className="big-stat small-stat">Verified</div><p className="fine-print">Last completed verification: {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: user.timezone }).format(lastOtp.createdAt)} ({user.timezone}).</p></> : <><div className="big-stat small-stat">No checks yet</div><p className="fine-print">An email code is requested the next time your sign-in needs additional verification.</p></>}<div className="detail-bottom"><span>One-time codes expire after</span><strong>{configuredPositiveInteger("OTP_TTL_MINUTES", 10, 30)} min</strong></div></article>
        </section>
      </div>
    </AppShell>
  );
}
