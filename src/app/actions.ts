"use server";

import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  ownedActiveSessionWhere,
  ownedActiveTrustedDeviceWhere,
} from "@/lib/security/authorization";
import {
  clearAuthCookies,
  configuredPositiveInteger,
  deviceLabel,
  authSecret,
  generateOtp,
  generateToken,
  getCurrentUser,
  getCurrentSession,
  getTrustedCookieHash,
  hashEmail,
  hashRateLimitKey,
  hashOtp,
  hashToken,
  otpMatches,
  setAuthCookies,
} from "@/lib/security/auth";
import { recordAudit } from "@/lib/security/audit";
import { removeDevelopmentOtp } from "@/lib/security/dev-otp";
import { EmailDeliveryError, isOtpDeliveryConfigured, sendLoginOtp } from "@/lib/security/email";
import { getRequestContext } from "@/lib/security/request-context";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { assessLoginRisk, decideOtp, initialThemeAt, themeForLogin } from "@/lib/security/rules";
import { loginSchema, otpSchema, registrationSchema } from "@/lib/security/validation";

const DUMMY_PASSWORD_HASH = argon2.hash(randomBytes(32).toString("hex"), {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});
const PASSWORD_MAX_ATTEMPTS = 10;
const OTP_MAX_PER_HOUR = 5;

export async function registerAction(formData: FormData) {
  await assertSameOrigin();
  const parsed = registrationSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/register?error=invalid");

  const { displayName, email, password } = parsed.data;
  authSecret();
  const context = await getRequestContext();
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  try {
    const user = await db.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        theme: initialThemeAt(new Date()),
      },
      select: { id: true },
    });
    await recordAudit({
      userId: user.id,
      email,
      context,
      outcome: "SUCCESS",
      reason: "REGISTRATION",
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) redirect("/register?error=invalid");
    throw error;
  }

  redirect("/login?registered=1");
}

export async function loginAction(formData: FormData) {
  await assertSameOrigin();
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/login?error=credentials");

  const { email, password } = parsed.data;
  const context = await getRequestContext();
  const emailHash = hashEmail(email);
  const loginRateKeys = [
    `login:email:${hashRateLimitKey("email", email)}`,
    ...(context.ipAddress
      ? [`login:ip:${hashRateLimitKey("ip", context.ipAddress)}`]
      : []),
  ];
  if (!(await consumeRateLimit(loginRateKeys, PASSWORD_MAX_ATTEMPTS, 15 * 60 * 1000))) {
    await recordAudit({
      email,
      context,
      outcome: "BLOCKED",
      reason: "PASSWORD_RATE_LIMIT",
    });
    redirect("/login?error=rate-limit");
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, theme: true, themeManuallySet: true },
  });
  const passwordMatches = await argon2.verify(
    user?.passwordHash ?? (await DUMMY_PASSWORD_HASH),
    password,
  );
  if (!user || !passwordMatches) {
    await recordAudit({
      userId: user?.id,
      email,
      context,
      outcome: "FAILURE",
      reason: "FAILED_PASSWORD",
    });
    redirect("/login?error=credentials");
  }

  const trustedCookieHash = await getTrustedCookieHash();
  const trusted = trustedCookieHash
    ? await db.trustedDevice.findFirst({
        where: { userId: user.id, tokenHash: trustedCookieHash, revokedAt: null },
      })
    : null;
  const currentRiskContext = {
    ipAddress: context.ipAddress,
    browser: context.browser,
    operatingSystem: context.operatingSystem,
    deviceCategory: context.deviceCategory,
    city: context.city,
    region: context.region,
  };
  const riskReasons = assessLoginRisk(currentRiskContext, trusted, new Date());

  if (riskReasons.length > 0) {
    if (!isOtpDeliveryConfigured()) {
      await recordAudit({
        userId: user.id,
        email,
        context,
        outcome: "FAILURE",
        reason: "OTP_DELIVERY_FAILED",
      });
      redirect("/login?error=email");
    }
    const otpRateKeys = [
      `otp:user:${hashRateLimitKey("user", user.id)}`,
      ...(context.ipAddress
        ? [`otp:ip:${hashRateLimitKey("ip", context.ipAddress)}`]
        : []),
    ];
    if (!(await consumeRateLimit(otpRateKeys, OTP_MAX_PER_HOUR, 60 * 60 * 1000))) {
      await recordAudit({
        userId: user.id,
        email,
        context,
        outcome: "BLOCKED",
        reason: "OTP_RATE_LIMIT",
      });
      redirect("/login?error=otp-rate-limit");
    }

    const challengeId = await createOtpChallenge(user.id, email, context, riskReasons);
    redirect(`/verify?challenge=${encodeURIComponent(challengeId)}`);
  }

  const sessionToken = generateToken();
  const now = new Date();
  await db.$transaction(async (transaction) => {
    const session = await transaction.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(sessionToken),
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        browser: context.browser,
        operatingSystem: context.operatingSystem,
        deviceCategory: context.deviceCategory,
        city: context.city,
        region: context.region,
        country: context.country,
      },
    });
    await transaction.auditEvent.create({
      data: {
        userId: user.id,
        emailHash,
        sessionId: session.id,
        trustedDeviceId: trusted?.id,
        ...auditContext(context),
        outcome: "SUCCESS",
        reason: "LOGIN_SUCCESS",
        trusted: true,
      },
    });
    const updatedTheme = themeForLogin(
      user.themeManuallySet,
      user.theme,
      now,
    );
    if (!user.themeManuallySet) {
      await transaction.user.update({
        where: { id: user.id },
        data: { theme: updatedTheme },
      });
    }
    if (trusted) {
      await transaction.trustedDevice.update({
        where: { id: trusted.id },
        data: { lastSeenAt: now },
      });
    }
  });
  await setAuthCookies(sessionToken);
  redirect("/");
}

async function createOtpChallenge(
  userId: string,
  email: string,
  context: Awaited<ReturnType<typeof getRequestContext>>,
  riskReasons: string[],
) {
  const code = generateOtp();
  const expiresAt = new Date(
    Date.now() + configuredPositiveInteger("OTP_TTL_MINUTES", 10, 30) * 60 * 1000,
  );
  const challenge = await db.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    await transaction.otpChallenge.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const created = await transaction.otpChallenge.create({
      data: {
        userId,
        codeHash: hashOtp("pending", code),
        riskReasons,
        expiresAt,
        ...auditContext(context),
      },
      select: { id: true },
    });
    await transaction.otpChallenge.update({
      where: { id: created.id },
      data: { codeHash: hashOtp(created.id, code) },
    });
    return created;
  });

  try {
    await sendLoginOtp(email, code, {
      challengeId: challenge.id,
      expiresAt,
    });
  } catch (error) {
    await db.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    await recordAudit({
      userId,
      email,
      context,
      outcome: "FAILURE",
      reason: "OTP_DELIVERY_FAILED",
    });
    if (error instanceof EmailDeliveryError) redirect("/login?error=email");
    throw error;
  }

  await db.$transaction([
    db.auditEvent.create({
      data: {
        userId,
        emailHash: hashEmail(email),
        ...auditContext(context),
        outcome: "CHALLENGE",
        reason: "OTP_REQUIRED",
      },
    }),
    db.auditEvent.create({
      data: {
        userId,
        emailHash: hashEmail(email),
        ...auditContext(context),
        outcome: "CHALLENGE",
        reason: "OTP_ISSUED",
      },
    }),
  ]);
  return challenge.id;
}

export async function verifyOtpAction(formData: FormData) {
  await assertSameOrigin();
  const parsed = otpSchema.safeParse({
    challengeId: formData.get("challengeId"),
    code: formData.get("code"),
  });
  if (!parsed.success) redirect("/login?error=otp");

  const { challengeId, code } = parsed.data;
  const challenge = await db.otpChallenge.findUnique({
    where: { id: challengeId },
    include: {
      user: {
        select: { id: true, email: true, theme: true, themeManuallySet: true },
      },
    },
  });
  const now = new Date();
  const maxAttempts = configuredPositiveInteger("OTP_MAX_ATTEMPTS", 5, 10);
  if (!challenge) {
    redirect("/login?error=otp");
  }

  const context = await getRequestContext();
  const decision = decideOtp(
    challenge,
    otpMatches(challenge.id, code, challenge.codeHash),
    maxAttempts,
    now,
  );
  if (decision === "consumed" || decision === "expired" || decision === "locked") {
    await recordAudit({
      userId: challenge.userId,
      email: challenge.user.email,
      context,
      outcome: "FAILURE",
      reason: "OTP_FAILED",
    });
    redirect("/login?error=otp");
  }
  if (decision === "incorrect") {
    const updated = await db.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: maxAttempts },
      },
      data: { attempts: { increment: 1 } },
    });
    if (updated.count === 1) {
      await recordAudit({
        userId: challenge.userId,
        email: challenge.user.email,
        context,
        outcome: "FAILURE",
        reason: "OTP_FAILED",
      });
    }
    redirect("/login?error=otp");
  }

  const sessionToken = generateToken();
  const trustToken = generateToken();
  const trustDays = configuredPositiveInteger("TRUSTED_DEVICE_DAYS", 30, 365);
  const sessionExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const trustExpiresAt = new Date(now.getTime() + trustDays * 24 * 60 * 60 * 1000);
  const emailHash = hashEmail(challenge.user.email);
  const createdDevice = await db.$transaction(async (transaction) => {
    const consumed = await transaction.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: maxAttempts },
      },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) return null;

    const trustedDevice = await transaction.trustedDevice.create({
      data: {
        userId: challenge.userId,
        tokenHash: hashToken(trustToken),
        label: deviceLabel(context) || context.deviceCategory,
        browser: context.browser,
        operatingSystem: context.operatingSystem,
        deviceCategory: context.deviceCategory,
        ipAddress: context.ipAddress,
        city: context.city,
        region: context.region,
        country: context.country,
        expiresAt: trustExpiresAt,
      },
    });
    const session = await transaction.session.create({
      data: {
        userId: challenge.userId,
        tokenHash: hashToken(sessionToken),
        expiresAt: sessionExpiresAt,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        browser: context.browser,
        operatingSystem: context.operatingSystem,
        deviceCategory: context.deviceCategory,
        city: context.city,
        region: context.region,
        country: context.country,
      },
    });
    await transaction.auditEvent.createMany({
      data: [
        {
          userId: challenge.userId,
          emailHash,
          sessionId: session.id,
          ...auditContext(context),
          outcome: "SUCCESS",
          reason: "OTP_VERIFIED",
          trusted: false,
        },
        {
          userId: challenge.userId,
          emailHash,
          sessionId: session.id,
          ...auditContext(context),
          outcome: "SUCCESS",
          reason: "LOGIN_SUCCESS",
          trusted: false,
        },
        {
          userId: challenge.userId,
          emailHash,
          sessionId: session.id,
          trustedDeviceId: trustedDevice.id,
          ...auditContext(context),
          outcome: "SUCCESS",
          reason: "TRUST_CREATED",
          trusted: true,
        },
      ],
    });
    const updatedTheme = themeForLogin(
      challenge.user.themeManuallySet,
      challenge.user.theme,
      now,
    );
    await transaction.user.update({
      where: { id: challenge.userId },
      data: {
        emailVerifiedAt: now,
        ...(!challenge.user.themeManuallySet ? { theme: updatedTheme } : {}),
      },
    });
    return trustedDevice.id;
  });

  if (!createdDevice) redirect("/login?error=otp");
  removeDevelopmentOtp(challenge.id);
  await setAuthCookies(sessionToken, trustToken);
  redirect("/");
}

export async function logoutAction() {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (user) {
    const session = await getCurrentSession(user.id);
    if (session) {
      const context = await getRequestContext();
      await db.$transaction([
        db.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        }),
        db.auditEvent.create({
          data: {
            userId: user.id,
            sessionId: session.id,
            ...auditContext(context),
            outcome: "SUCCESS",
            reason: "SESSION_REVOKED",
          },
        }),
      ]);
    }
  }
  await clearAuthCookies();
  redirect("/login?loggedOut=1");
}

export async function changeThemeAction(formData: FormData) {
  await assertSameOrigin();
  const user = await requireUser();
  const theme = formData.get("theme");
  if (theme !== "LIGHT" && theme !== "DARK") redirect("/settings?error=theme");
  await db.user.update({
    where: { id: user.id },
    data: { theme, themeManuallySet: true },
  });
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

export async function updateProfileAction(formData: FormData) {
  await assertSameOrigin();
  const user = await requireUser();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  if (
    displayName.length < 1 ||
    displayName.length > 80 ||
    !isTimeZone(timezone)
  ) {
    redirect("/settings?error=profile");
  }
  await db.user.update({
    where: { id: user.id },
    data: { displayName, timezone },
  });
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

export async function revokeDeviceAction(formData: FormData) {
  await assertSameOrigin();
  const user = await requireUser();
  const id = String(formData.get("deviceId") ?? "");
  const context = await getRequestContext();
  const result = await db.trustedDevice.updateMany({
    where: ownedActiveTrustedDeviceWhere(user.id, id),
    data: { revokedAt: new Date() },
  });
  if (result.count === 1) {
    await recordAudit({
      userId: user.id,
      context,
      outcome: "SUCCESS",
      reason: "TRUST_REVOKED",
      trusted: true,
      trustedDeviceId: id,
    });
  } else {
    redirect("/devices?error=device");
  }
  revalidatePath("/devices");
  redirect("/devices?revoked=1");
}

export async function revokeSessionAction(formData: FormData) {
  await assertSameOrigin();
  const user = await requireUser();
  const id = String(formData.get("sessionId") ?? "");
  const current = await getCurrentSession(user.id);
  const context = await getRequestContext();
  const result = await db.session.updateMany({
    where: ownedActiveSessionWhere(user.id, id, new Date()),
    data: { revokedAt: new Date() },
  });
  if (result.count === 1) {
    await recordAudit({
      userId: user.id,
      context,
      outcome: "SUCCESS",
      reason: "SESSION_REVOKED",
      sessionId: id,
    });
  } else if (id !== current?.id) {
    redirect("/sessions?error=session");
  }
  if (id === current?.id) await clearAuthCookies();
  revalidatePath("/sessions");
  redirect(id === current?.id ? "/login?loggedOut=1" : "/sessions?revoked=1");
}

export async function revokeOtherSessionsAction() {
  await assertSameOrigin();
  const user = await requireUser();
  const current = await getCurrentSession(user.id);
  const sessions = await db.session.findMany({
    where: {
      userId: user.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ...(current ? { id: { not: current.id } } : {}),
    },
    select: { id: true },
  });
  const now = new Date();
  const context = await getRequestContext();
  await db.$transaction(async (transaction) => {
    await transaction.session.updateMany({
      where: { id: { in: sessions.map((session) => session.id) }, userId: user.id },
      data: { revokedAt: now },
    });
    if (sessions.length > 0) {
      await transaction.auditEvent.createMany({
        data: sessions.map((session) => ({
          userId: user.id,
          sessionId: session.id,
          ...auditContext(context),
          outcome: "SUCCESS" as const,
          reason: "SESSION_REVOKED" as const,
        })),
      });
    }
  });
  revalidatePath("/sessions");
  redirect(`/sessions?revoked=${sessions.length}`);
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

async function assertSameOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("host");
  if (!origin || !host) throw new Error("Request origin could not be verified.");
  const originUrl = new URL(origin);
  if (
    (originUrl.protocol !== "https:" && originUrl.protocol !== "http:") ||
    originUrl.host !== host
  ) {
    throw new Error("Cross-origin form submission rejected.");
  }
}

function auditContext(context: Awaited<ReturnType<typeof getRequestContext>>) {
  return {
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    browser: context.browser,
    operatingSystem: context.operatingSystem,
    deviceCategory: context.deviceCategory,
    deviceModel: context.deviceModel,
    city: context.city,
    region: context.region,
    country: context.country,
  };
}

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
