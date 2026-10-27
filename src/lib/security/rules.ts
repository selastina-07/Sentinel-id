export type Theme = "LIGHT" | "DARK";

export function initialThemeAt(date: Date): Theme {
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(timeParts.find((part) => part.type === "hour")?.value);

  return hour >= 5 && hour < 12 ? "LIGHT" : "DARK";
}

export function themeForLogin(
  manuallySet: boolean,
  savedTheme: Theme,
  now: Date,
): Theme {
  return manuallySet ? savedTheme : initialThemeAt(now);
}

export type OtpDecision = "expired" | "consumed" | "locked" | "incorrect" | "verified";

export function decideOtp(
  challenge: {
    expiresAt: Date;
    consumedAt: Date | null;
    attempts: number;
  },
  codeMatches: boolean,
  maxAttempts: number,
  now = new Date(),
): OtpDecision {
  if (challenge.consumedAt) return "consumed";
  if (challenge.expiresAt <= now) return "expired";
  if (challenge.attempts >= maxAttempts) return "locked";
  return codeMatches ? "verified" : "incorrect";
}

export interface RiskContext {
  ipAddress: string | null;
  browser: string | null;
  operatingSystem: string | null;
  deviceCategory: string | null;
  city: string | null;
  region: string | null;
}

export interface TrustedContext extends RiskContext {
  expiresAt: Date;
  revokedAt: Date | null;
}

export function assessLoginRisk(
  current: RiskContext,
  trusted: TrustedContext | null,
  now = new Date(),
): string[] {
  if (!trusted || trusted.revokedAt || trusted.expiresAt <= now) {
    return ["new_device"];
  }

  const reasons: string[] = [];
  if (
    current.browser !== trusted.browser ||
    current.operatingSystem !== trusted.operatingSystem ||
    current.deviceCategory !== trusted.deviceCategory
  ) {
    reasons.push("browser_changed");
  }
  if (current.ipAddress !== trusted.ipAddress) {
    reasons.push("ip_changed");
  }
  if (
    current.city &&
    current.region &&
    trusted.city &&
    trusted.region &&
    (current.city !== trusted.city || current.region !== trusted.region)
  ) {
    reasons.push("location_changed");
  }
  return reasons;
}
