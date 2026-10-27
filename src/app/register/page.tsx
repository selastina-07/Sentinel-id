import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck, ShieldEllipsis } from "lucide-react";
import { registerAction } from "@/app/actions";

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense fallback={<RegistrationFallback />}>
      <RegistrationForm searchParams={searchParams} />
    </Suspense>
  );
}

async function RegistrationForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <Link className="auth-back" href="/"><ArrowLeft size={15} /> Back to SentinelID</Link>
      <section className="auth-card">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark"><ShieldEllipsis size={21} /></span>
          <span className="brand-copy">Sentinel<span>ID</span><small>ACCOUNT SECURITY</small></span>
        </Link>
        <div className="auth-heading"><span className="auth-icon"><ShieldCheck size={20} /></span><h1>Create your account</h1><p>Start with a safer, clearer way to manage sign-ins.</p></div>
        {params.error && <div className="notice error-notice" role="alert">We couldn&apos;t create an account with those details. Please check them and try again.</div>}
        <form action={registerAction} className="auth-form">
          <label htmlFor="displayName">Your name</label>
          <input autoComplete="name" id="displayName" name="displayName" type="text" placeholder="How should we address you?" required maxLength={80} />
          <label htmlFor="email">Email address</label>
          <input autoComplete="email" id="email" name="email" type="email" placeholder="you@example.com" required maxLength={254} />
          <label htmlFor="password">Create a password</label>
          <input autoComplete="new-password" id="password" name="password" type="password" placeholder="Use at least 12 characters" required minLength={12} maxLength={128} />
          <button className="button button-primary button-full" type="submit">Create account <ArrowRight size={16} /></button>
          <p className="auth-privacy"><ShieldCheck size={14} /> Your password is protected with Argon2id.</p>
        </form>
        <div className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></div>
      </section>
      <p className="auth-footer">Verification is sent only when a sign-in needs an extra check.</p>
    </main>
  );
}

function RegistrationFallback() {
  return (
    <main className="auth-page">
      <div className="loading-spinner" role="status" aria-label="Loading registration form" />
    </main>
  );
}
