import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { UAParser } from "ua-parser-js";
import { db } from "@/lib/db";
import type { RequestContext } from "@/lib/security/request-context";

const SESSION_COOKIE = "sentinel_session";
const TRUST_COOKIE = "sentinel_trusted";
const SESSION_DAYS = 7;

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashEmail(email: string): string {
  return createHmac("sha256", authSecret()).update(email).digest("hex");
}

export function hashRateLimitKey(scope: string, value: string): string {
  return createHmac("sha256", authSecret())
    .update(`${scope}:${value}`)
    .digest("hex");
}

export function hashOtp(challengeId: string, code: string): string {
  return createHmac("sha256", authSecret())
    .update(`${challengeId}:${code}`)
    .digest("hex");
}

export function otpMatches(challengeId: string, code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(challengeId, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function deviceLabel(context: RequestContext): string {
  const parser = new UAParser(context.userAgent ?? "").getResult();
  return [parser.browser.name, parser.os.name, context.deviceCategory].filter(Boolean).join(" · ");
}

export async function setAuthCookies(sessionToken: string, trustToken?: string) {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  if (trustToken) {
    const days = configuredPositiveInteger("TRUSTED_DEVICE_DAYS", 30, 365);
    cookieStore.set(TRUST_COOKIE, trustToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: days * 24 * 60 * 60,
    });
  }
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(TRUST_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findFirst({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true, lastSeenAt: true },
  });
  if (!session) return null;
  const now = new Date();
  if (session.lastSeenAt.getTime() < now.getTime() - 5 * 60 * 1000) {
    await db.session.updateMany({
      where: {
        id: session.id,
        userId: session.userId,
        revokedAt: null,
        expiresAt: { gt: now },
        lastSeenAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) },
      },
      data: { lastSeenAt: now },
    });
  }
  const trustedToken = cookieStore.get(TRUST_COOKIE)?.value;
  if (trustedToken) {
    await db.trustedDevice.updateMany({
      where: {
        userId: session.userId,
        tokenHash: hashToken(trustedToken),
        revokedAt: null,
        expiresAt: { gt: now },
        lastSeenAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) },
      },
      data: { lastSeenAt: now },
    });
  }
  return db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      theme: true,
      themeManuallySet: true,
      timezone: true,
      emailVerifiedAt: true,
    },
  });
}

export async function getCurrentSession(userId: string) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return db.session.findFirst({
    where: {
      userId,
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
}

export async function getTrustedCookieHash() {
  const token = (await cookies()).get(TRUST_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

export function configuredPositiveInteger(
  name: string,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const configured = process.env[name];
  if (!configured) return fallback;
  const parsed = Number(configured);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}.`);
  }
  return parsed;
}
