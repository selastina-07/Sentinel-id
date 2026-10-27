import { Check, Palette, Save, UserRound } from "lucide-react";
import { changeThemeAction, updateProfileAction } from "@/app/actions";
import { AppShell, PageHeading } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/security/auth";
import { redirect } from "next/navigation";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { error, saved } = await searchParams;
  return (
    <AppShell activePath="/settings" displayName={user.displayName} email={user.email} theme={user.theme}>
      <div className="content-wrap">
        <PageHeading eyebrow="YOUR PREFERENCES" title="Profile & settings" description="Choose how SentinelID looks and how dates are displayed for you." />
        {saved && <div className="notice success-notice" role="status"><Check size={15} /> Changes saved.</div>}
        {error && <div className="notice error-notice" role="alert">Please check your profile details and try again.</div>}
        <div className="settings-grid">
          <section className="panel settings-panel">
            <div className="panel-heading"><div><h2>Profile information</h2><p>Update your name and preferred timezone.</p></div><UserRound size={19} /></div>
            <form action={updateProfileAction} className="settings-form">
              <label htmlFor="displayName">Display name</label><input id="displayName" name="displayName" defaultValue={user.displayName} required maxLength={80} />
              <label htmlFor="email">Email address</label><input id="email" value={user.email} disabled readOnly /><small className="field-help">Your email address is used for sign-in and security verification.</small>
              <label htmlFor="timezone">Timezone</label><input id="timezone" name="timezone" defaultValue={user.timezone} placeholder="Asia/Kolkata" required maxLength={80} /><small className="field-help">Use a valid IANA timezone, such as Asia/Kolkata or Europe/London.</small>
              <button className="button button-primary" type="submit"><Save size={15} /> Save profile</button>
            </form>
          </section>
          <section className="panel settings-panel theme-panel">
            <div className="panel-heading"><div><h2>Appearance</h2><p>Your theme follows you across devices.</p></div><Palette size={19} /></div>
            <div className="theme-current"><span className={`theme-preview ${user.theme === "LIGHT" ? "preview-light" : "preview-dark"}`}><span /><span /><span /></span><div><strong>{user.theme === "LIGHT" ? "Light theme" : "Dark theme"}</strong><small>{user.themeManuallySet ? "Your saved preference" : "Initial preference based on IST sign-in time"}</small></div></div>
            <p className="fine-print">For new accounts, light is selected from 05:00 to 11:59 IST; dark is selected otherwise. After you set a theme here, later sign-ins never override your choice.</p>
            <div className="theme-actions">
              <form action={changeThemeAction}><input type="hidden" name="theme" value="LIGHT" /><button className={`theme-choice ${user.theme === "LIGHT" ? "selected" : ""}`} type="submit"><span className="theme-swatch light-swatch" />Light{user.theme === "LIGHT" && <Check size={15} />}</button></form>
              <form action={changeThemeAction}><input type="hidden" name="theme" value="DARK" /><button className={`theme-choice ${user.theme === "DARK" ? "selected" : ""}`} type="submit"><span className="theme-swatch dark-swatch" />Dark{user.theme === "DARK" && <Check size={15} />}</button></form>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
