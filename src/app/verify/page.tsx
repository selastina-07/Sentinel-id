import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, MailCheck, ShieldEllipsis } from "lucide-react";
import { verifyOtpAction } from "@/app/actions";
import { readDevelopmentOtp } from "@/lib/security/dev-otp";

export default function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  return (
    <Suspense fallback={<VerificationFallback />}>
      <VerificationForm searchParams={searchParams} />
    </Suspense>
  );
}

async function VerificationForm({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  const { challenge } = await searchParams;
  const developmentOtp = challenge ? readDevelopmentOtp(challenge) : null;
  return (
    <main className="auth-page">
      <Link className="auth-back" href="/login"><ArrowLeft size={15} /> Back to sign in</Link>
      <section className="auth-card">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark"><ShieldEllipsis size={21} /></span>
          <span className="brand-copy">Sentinel<span>ID</span><small>ACCOUNT SECURITY</small></span>
        </Link>
        <div className="auth-heading"><span className="auth-icon"><MailCheck size={20} /></span><h1>Check your inbox</h1><p>A new sign-in needs an extra check. Enter the six-digit code we sent to your email.</p></div>
        {challenge ? (
          <>
            {developmentOtp && (
              <div className="notice success-notice" role="status">
                Development-only local code: <strong>{developmentOtp}</strong>
              </div>
            )}
            <form action={verifyOtpAction} className="auth-form">
              <input type="hidden" name="challengeId" value={challenge} />
              <label htmlFor="code">Verification code</label>
              <input className="otp-input" autoComplete="one-time-code" id="code" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" placeholder="000000" required maxLength={6} />
              <button className="button button-primary button-full" type="submit">Verify and sign in <ArrowRight size={16} /></button>
              <p className="auth-privacy"><MailCheck size={13} /> The code expires soon and can only be used once.</p>
            </form>
          </>
        ) : (
          <div className="notice error-notice" role="alert">This verification link is missing. Start again from sign in.</div>
        )}
        <div className="auth-switch"><Link href="/login">Return to sign in</Link></div>
      </section>
      <p className="auth-footer">Never share your verification code with anyone.</p>
    </main>
  );
}

function VerificationFallback() {
  return (
    <main className="auth-page">
      <div className="loading-spinner" role="status" aria-label="Loading verification form" />
    </main>
  );
}
