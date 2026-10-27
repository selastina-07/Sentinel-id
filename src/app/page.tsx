import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Fingerprint,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  ShieldEllipsis,
  Sparkles,
} from "lucide-react";
import { AppShell, EmptyState, PageHeading, SecurityCard, StatusPill } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/security/auth";
import { isOtpDeliveryConfigured } from "@/lib/security/email";
import { db } from "@/lib/db";
import { userTimestamp } from "@/components/app-shell";

const CURRENT_YEAR = 2026;

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <WelcomePage />;

  const [devices, activeSessions, events, latestEvents] = await Promise.all([
    db.trustedDevice.count({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
    db.session.count({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
    db.auditEvent.count({ where: { userId: user.id } }),
    db.auditEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        reason: true,
        outcome: true,
        city: true,
        region: true,
        country: true,
        browser: true,
        deviceCategory: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <AppShell
      activePath="/"
      displayName={user.displayName}
      email={user.email}
      theme={user.theme}
    >
      <div className="content-wrap">
        <PageHeading
          eyebrow="SECURITY OVERVIEW"
          title={`Good to see you, ${user.displayName.split(" ")[0]}.`}
          description="A clear view of your account's protection, devices, and recent activity."
          action={
            <StatusPill warning={!isOtpDeliveryConfigured()}>
              {isOtpDeliveryConfigured() ? "Account security active" : "Email setup needed"}
            </StatusPill>
          }
        />
        <section className="welcome-strip">
          <div className="welcome-emblem"><ShieldCheck size={24} /></div>
          <div><strong>Your account security, at a glance</strong><p>Security activity shown here is from your account only. New accounts start with a clean history.</p></div>
          <Link className="text-link" href="/security">Review security <ArrowRight size={15} /></Link>
        </section>
        <div className="section-title-row"><h2>Account snapshot</h2><span>Live account data</span></div>
        <section className="metrics-grid" aria-label="Account security summary">
          <SecurityCard title="Security status" value="Protected" note="Password and risk checks enabled" icon={<ShieldCheck size={18} />} />
          <SecurityCard title="Trusted devices" value={String(devices).padStart(2, "0")} note="Known devices with active trust" icon={<Fingerprint size={18} />} tone="blue" />
          <SecurityCard title="Active sessions" value={String(activeSessions).padStart(2, "0")} note="Signed-in browsers and devices" icon={<Globe2 size={18} />} tone="violet" />
          <SecurityCard title="Security events" value={String(events).padStart(2, "0")} note="Recorded for this account" icon={<Activity size={18} />} />
        </section>
        <section className="dashboard-grid">
          <article className="panel activity-panel">
            <div className="panel-heading"><div><h2>Recent activity</h2><p>Your account’s latest security events</p></div><Link className="subtle-link" href="/history">View history <ArrowUpRight size={15} /></Link></div>
            {latestEvents.length === 0 ? (
              <EmptyState title="No activity recorded yet" description="When you sign in or update your security settings, verified events will appear here." icon={<Activity size={20} />} />
            ) : (
              <div className="activity-list">
                {latestEvents.map((event) => (
                  <div className="activity-row" key={event.id}>
                    <span className={`event-symbol ${event.outcome.toLowerCase()}`}><Activity size={17} /></span>
                    <div className="activity-copy"><strong>{eventTitle(event.reason)}</strong><span>{[event.city, event.region, event.country].filter(Boolean).join(", ") || "Location unknown"} · {event.browser ?? event.deviceCategory ?? "Unknown device"}</span></div>
                    <time>{userTimestamp(event.createdAt, user.timezone)}</time>
                  </div>
                ))}
              </div>
            )}
          </article>
          <article className="panel insight-panel">
            <div className="panel-heading"><div><h2>Security essentials</h2><p>Keep control of your account</p></div><LockKeyhole size={18} /></div>
            <Link className="quick-action" href="/devices"><span className="quick-icon"><Fingerprint size={18} /></span><span><strong>Trusted devices</strong><small>Review and revoke device access</small></span><ArrowRight size={16} /></Link>
            <Link className="quick-action" href="/sessions"><span className="quick-icon"><Globe2 size={18} /></span><span><strong>Active sessions</strong><small>Sign out of other browsers</small></span><ArrowRight size={16} /></Link>
            <Link className="quick-action" href="/settings"><span className="quick-icon"><Sparkles size={18} /></span><span><strong>Personalize your space</strong><small>Profile, timezone, and appearance</small></span><ArrowRight size={16} /></Link>
            <div className="security-footnote"><ShieldCheck size={15} /> Risk-based email verification is active</div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}

function WelcomePage() {
  return (
    <main className="marketing-page">
      <header className="marketing-header">
        <Link className="brand" href="/">
          <span className="brand-mark"><ShieldEllipsis size={21} /></span>
          <span className="brand-copy">Sentinel<span>ID</span><small>ACCOUNT SECURITY</small></span>
        </Link>
        <div className="marketing-nav"><Link href="/login">Sign in</Link><Link className="button button-primary" href="/register">Create account <ArrowRight size={15} /></Link></div>
      </header>
      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="pulse-dot" /> PERSONAL ACCOUNT SECURITY</div>
          <h1>Security that<br />moves with <em>you.</em></h1>
          <p className="hero-description">A more thoughtful way to protect your account. SentinelID checks for risk when you sign in, then keeps your trusted devices and sessions in your hands.</p>
          <div className="hero-actions"><Link className="button button-primary button-large" href="/register">Get started <ArrowRight size={17} /></Link><Link className="button button-quiet button-large" href="/login">I already have an account</Link></div>
          <div className="hero-assurance"><span><LockKeyhole size={15} /> Private by design</span><span><ShieldCheck size={15} /> You stay in control</span></div>
        </div>
        <div className="hero-visual" aria-label="SentinelID protects accounts with adaptive verification">
          <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
          <div className="visual-center"><span><ShieldEllipsis size={43} strokeWidth={1.55} /></span><strong>Sentinel<span>ID</span></strong><small>ADAPTIVE SECURITY</small></div>
          <div className="float-card float-card-top"><span className="float-icon"><Fingerprint size={17} /></span><span><strong>Device-aware</strong><small>Recognize what&apos;s familiar</small></span><span className="float-check"><ShieldCheck size={15} /></span></div>
          <div className="float-card float-card-bottom"><span className="float-icon mint"><Activity size={17} /></span><span><strong>Risk-responsive</strong><small>Verify when it matters</small></span><span className="float-check"><ShieldCheck size={15} /></span></div>
          <span className="visual-spark spark-a"><Sparkles size={18} /></span><span className="visual-spark spark-b"><Sparkles size={14} /></span>
        </div>
      </section>
      <section className="feature-strip">
        <article><span><Fingerprint size={19} /></span><div><strong>Adaptive verification</strong><p>Email verification for unfamiliar sign-ins.</p></div></article>
        <article><span><Activity size={19} /></span><div><strong>Clear activity history</strong><p>Review real account events, not sample data.</p></div></article>
        <article><span><Globe2 size={19} /></span><div><strong>Device & session control</strong><p>Revoke trusted devices or sessions any time.</p></div></article>
      </section>
      <footer className="marketing-footer"><span>SentinelID</span><span>Security starts with clarity.</span><span>© {CURRENT_YEAR} SentinelID</span></footer>
    </main>
  );
}

function eventTitle(reason: string) {
  const labels: Record<string, string> = {
    LOGIN_SUCCESS: "Successful sign-in",
    FAILED_PASSWORD: "Unsuccessful sign-in",
    OTP_REQUIRED: "Additional verification required",
    OTP_ISSUED: "Verification code sent",
    OTP_DELIVERY_FAILED: "Verification email could not be delivered",
    OTP_FAILED: "Verification unsuccessful",
    OTP_VERIFIED: "Email verification completed",
    TRUST_CREATED: "Trusted device added",
    TRUST_REVOKED: "Trusted device revoked",
    SESSION_REVOKED: "Session signed out",
    PASSWORD_RATE_LIMIT: "Sign-in temporarily rate-limited",
    OTP_RATE_LIMIT: "Verification temporarily rate-limited",
    REGISTRATION: "Account created",
  };
  return labels[reason] ?? "Security event";
}
