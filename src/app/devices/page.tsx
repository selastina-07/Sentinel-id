import { Fingerprint, ShieldCheck } from "lucide-react";
import { revokeDeviceAction } from "@/app/actions";
import { AppShell, DeviceIcon, EmptyState, PageHeading, userTimestamp } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/security/auth";
import { db } from "@/lib/db";
import { configuredPositiveInteger } from "@/lib/security/auth";
import { redirect } from "next/navigation";

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ revoked?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { revoked, error } = await searchParams;
  const devices = await db.trustedDevice.findMany({
    where: { userId: user.id },
    orderBy: { lastSeenAt: "desc" },
    take: 50,
    select: {
      id: true,
      label: true,
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
      revokedAt: true,
    },
  });
  return (
    <AppShell activePath="/devices" displayName={user.displayName} email={user.email} theme={user.theme}>
      <div className="content-wrap">
        <PageHeading eyebrow="RECOGNIZED SIGN-INS" title="Trusted devices" description="Devices you approved after email verification. You can revoke their trust at any time." />
        {revoked && <div className="notice success-notice" role="status">Device trust was revoked.</div>}
        {error && <div className="notice error-notice" role="alert">That trusted device could not be revoked. Refresh and try again.</div>}
        <div className="history-note"><ShieldCheck size={16} /><span>Trust lasts <strong>{configuredPositiveInteger("TRUSTED_DEVICE_DAYS", 30, 365)} days</strong> by default. Each device is identified by a random, revocable browser token—not by its user-agent alone.</span></div>
        <section className="panel records-panel">
          <div className="panel-heading"><div><h2>Your trusted devices</h2><p>{devices.filter((device) => !device.revokedAt && device.expiresAt > new Date()).length} currently active</p></div><Fingerprint size={19} /></div>
          {devices.length === 0 ? <EmptyState title="No trusted devices" description="A device is added only after you complete an email verification challenge during sign-in." icon={<Fingerprint size={20} />} /> : (
            <div className="record-list">
              {devices.map((device) => {
                const active = !device.revokedAt && device.expiresAt > new Date();
                return <article className="record-row" key={device.id}>
                  <span className="record-icon"><DeviceIcon category={device.deviceCategory} /></span>
                  <div className="record-main"><strong>{device.label || "Unrecognized device"}</strong><span>{[device.browser, device.operatingSystem].filter(Boolean).join(" · ") || "Device details unknown"}</span><small>{[device.city, device.region, device.country].filter(Boolean).join(", ") || "Location unknown"}{device.ipAddress ? ` · ${device.ipAddress}` : ""}</small></div>
                  <div className="record-meta"><span className={`record-status ${active ? "active" : "inactive"}`}>{device.revokedAt ? "Revoked" : active ? "Trusted" : "Expired"}</span><small>Last seen {userTimestamp(device.lastSeenAt, user.timezone)}</small><small>{device.revokedAt ? `Revoked ${userTimestamp(device.revokedAt, user.timezone)}` : `Expires ${userTimestamp(device.expiresAt, user.timezone)}`}</small></div>
                  {active && <form action={revokeDeviceAction}><input type="hidden" name="deviceId" value={device.id} /><button className="button button-outline button-small" type="submit">Revoke trust</button></form>}
                </article>;
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
