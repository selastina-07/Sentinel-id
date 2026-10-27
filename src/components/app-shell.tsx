import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Monitor,
  Settings2,
  ShieldCheck,
  ShieldEllipsis,
  Smartphone,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/security", label: "Account security", icon: ShieldCheck },
  { href: "/history", label: "Login history", icon: Activity },
  { href: "/devices", label: "Trusted devices", icon: Fingerprint },
  { href: "/sessions", label: "Active sessions", icon: Monitor },
  { href: "/settings", label: "Profile & settings", icon: Settings2 },
];

export function AppShell({
  children,
  displayName,
  email,
  theme,
  activePath,
}: {
  children: ReactNode;
  displayName: string;
  email: string;
  theme: "LIGHT" | "DARK";
  activePath: string;
}) {
  return (
    <div className="app-shell" data-theme={theme.toLowerCase()}>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="SentinelID overview">
          <span className="brand-mark"><ShieldEllipsis size={21} strokeWidth={2.1} /></span>
          <span className="brand-copy">Sentinel<span>ID</span><small>ACCOUNT SECURITY</small></span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              aria-current={activePath === href ? "page" : undefined}
              className={`nav-link${activePath === href ? " active" : ""}`}
              href={href}
              key={href}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Account security" && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help">
          <span className="help-icon"><ShieldCheck size={17} /></span>
          <div><strong>Security, made personal.</strong><span>Your account. Your rules.</span></div>
          <ArrowUpRight size={15} />
        </div>
        <div className="sidebar-profile">
          <span className="avatar">{initials(displayName)}</span>
          <span className="profile-copy"><strong>{displayName}</strong><small>{email}</small></span>
          <form action={logoutAction}>
            <button className="icon-button logout-button" aria-label="Sign out" title="Sign out">
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </aside>
      <main className="main-area">
        <header className="mobile-header">
          <Link className="brand" href="/">
            <span className="brand-mark"><ShieldEllipsis size={19} /></span>
            <span className="brand-copy">Sentinel<span>ID</span></span>
          </Link>
          <form action={logoutAction}>
            <button className="icon-button" aria-label="Sign out"><LogOut size={18} /></button>
          </form>
        </header>
        <div className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              aria-current={activePath === href ? "page" : undefined}
              className={activePath === href ? "active" : ""}
              href={href}
              key={href}
              title={label}
            >
              <Icon size={19} /><span>{label.split(" ")[0]}</span>
            </Link>
          ))}
        </div>
        {children}
      </main>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon = <Smartphone size={21} />,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function StatusPill({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return <span className={`status-pill${warning ? " status-warning" : ""}`}><span />{children}</span>;
}

export function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";
}

export function userTimestamp(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function SecurityCard({
  title,
  value,
  note,
  icon,
  tone = "green",
}: {
  title: string;
  value: string;
  note: string;
  icon: ReactNode;
  tone?: "green" | "blue" | "violet";
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-top"><span>{title}</span><span className="metric-icon">{icon}</span></div>
      <strong>{value}</strong><small>{note}</small>
    </article>
  );
}

export function AccountBadge() {
  return <span className="account-badge"><BadgeCheck size={14} /> Protected account</span>;
}

export function DeviceIcon({ category }: { category: string | null }) {
  return category === "Mobile" || category === "Tablet"
    ? <Smartphone size={19} />
    : <Monitor size={19} />;
}

export function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="info-line"><span>{label}</span><strong>{value}</strong></div>;
}

export function UserIcon() {
  return <UserRound size={17} />;
}
