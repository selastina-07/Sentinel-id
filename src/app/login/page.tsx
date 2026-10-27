import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldEllipsis } from "lucide-react";
import { loginAction } from "@/app/actions";

type SearchParams = Promise<{ error?: string; registered?: string; loggedOut?: string }>;

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginForm({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const messages: Record<string, string> = {
    credentials: "Email or password isn't correct. Please try again.",
    "rate-limit": "Too many attempts. Please wait a little before trying again.",
    "otp-rate-limit": "Too many verification requests. Please wait before trying again.",
    email: "We couldn't send a verification email. Please try again later or contact the administrator.",
    otp: "That verification code is invalid or expired. Start a new sign-in attempt.",
  };
  return (
    <main className="auth-page">
      <Link className="auth-back" href="/"><ArrowLeft size={15} /> Back to SentinelID</Link>
      <section className="auth-card">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark"><ShieldEllipsis size={21} /></span>
          <span className="brand-copy">Sentinel<span>ID</span><small>ACCOUNT SECURITY</small></span>
        </Link>
        <div className="auth-heading"><span className="auth-icon"><LockKeyhole size={20} /></span><h1>Welcome back</h1><p>Sign in to review your account security.</p></div>
        {params.registered && <div className="notice success-notice" role="status">Account created. Sign in to verify your email and continue.</div>}
        {params.loggedOut && <div className="notice success-notice" role="status">You’ve signed out successfully.</div>}
        {params.error && <div className="notice error-notice" role="alert">{messages[params.error] ?? "We couldn't complete that request."}</div>}
        <form action={loginAction} className="auth-form">
          <label htmlFor="email">Email address</label>
          <input autoComplete="email" id="email" name="email" type="email" placeholder="you@example.com" required maxLength={254} />
          <div className="label-row"><label htmlFor="password">Password</label><span>At least 12 characters</span></div>
          <input autoComplete="current-password" id="password" name="password" type="password" placeholder="Enter your password" required maxLength={128} />
          <button className="button button-primary button-full" type="submit">Continue securely <ArrowRight size={16} /></button>
          <p className="auth-privacy"><LockKeyhole size={13} /> Your password is checked securely on the server.</p>
        </form>
        <div className="auth-switch">New to SentinelID? <Link href="/register">Create an account</Link></div>
      </section>
      <p className="auth-footer">Protected by adaptive verification <span>·</span> Your security, your control</p>
    </main>
  );
}

function LoginFallback() {
  return (
    <main className="auth-page">
      <div className="loading-spinner" role="status" aria-label="Loading sign-in form" />
    </main>
  );
}
