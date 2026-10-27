import { headers } from "next/headers";
import { isIP } from "node:net";
import { UAParser } from "ua-parser-js";

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  browser: string | null;
  operatingSystem: string | null;
  deviceCategory: string;
  deviceModel: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
}

export async function getRequestContext(): Promise<RequestContext> {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 512) ?? null;
  const trustedProxy = process.env.VERCEL === "1" || process.env.TRUST_PROXY_HEADERS === "true";
  const ipAddress = trustedProxy
    ? normalizeIp(requestHeaders.get("x-real-ip"))
    : null;
  const parsed = new UAParser(userAgent ?? "").getResult();
  const deviceCategory =
    parsed.device.type === "mobile"
      ? "Mobile"
      : parsed.device.type === "tablet"
        ? "Tablet"
        : "Desktop";

  const location = ipAddress ? await lookupLocation(ipAddress) : null;
  return {
    ipAddress,
    userAgent,
    browser: parsed.browser.name
      ? `${parsed.browser.name}${parsed.browser.version ? ` ${parsed.browser.version}` : ""}`
      : null,
    operatingSystem: parsed.os.name
      ? `${parsed.os.name}${parsed.os.version ? ` ${parsed.os.version}` : ""}`
      : null,
    deviceCategory,
    deviceModel: parsed.device.model ?? null,
    city: location?.city ?? null,
    region: location?.region ?? null,
    country: location?.country ?? null,
  };
}

function normalizeIp(value: string | null): string | null {
  if (!value) return null;
  const ip = value.trim().replace(/^\[|\]$/g, "");
  return isIP(ip) ? ip : null;
}

interface IpInfoResponse {
  city?: string;
  region?: string;
  country?: string;
}

async function lookupLocation(ip: string): Promise<IpInfoResponse | null> {
  const token = process.env.IPINFO_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch(
      `https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(2500), cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(`IP geolocation request failed with status ${response.status}.`);
    }
    const value: unknown = await response.json();
    if (!value || typeof value !== "object") return null;
    const data = value as IpInfoResponse;
    return {
      city: typeof data.city === "string" ? data.city.slice(0, 120) : undefined,
      region: typeof data.region === "string" ? data.region.slice(0, 120) : undefined,
      country: typeof data.country === "string" ? data.country.slice(0, 120) : undefined,
    };
  } catch {
    console.error("SentinelID could not retrieve optional IP geolocation.");
    return null;
  }
}
