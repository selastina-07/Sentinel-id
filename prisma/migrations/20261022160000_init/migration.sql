-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'CHALLENGE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AuditReason" AS ENUM ('REGISTRATION', 'LOGIN_SUCCESS', 'FAILED_PASSWORD', 'OTP_REQUIRED', 'OTP_ISSUED', 'OTP_DELIVERY_FAILED', 'OTP_FAILED', 'OTP_VERIFIED', 'TRUST_CREATED', 'TRUST_REVOKED', 'SESSION_REVOKED', 'PASSWORD_RATE_LIMIT', 'OTP_RATE_LIMIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'DARK',
    "themeManuallySet" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "operatingSystem" TEXT,
    "deviceCategory" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "riskReasons" TEXT[],
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "operatingSystem" TEXT,
    "deviceCategory" TEXT,
    "deviceModel" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedDevice" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "browser" TEXT,
    "operatingSystem" TEXT,
    "deviceCategory" TEXT,
    "ipAddress" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "emailHash" TEXT,
    "sessionId" TEXT,
    "trustedDeviceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "operatingSystem" TEXT,
    "deviceCategory" TEXT,
    "deviceModel" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "outcome" "AuditOutcome" NOT NULL,
    "reason" "AuditReason" NOT NULL,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_revokedAt_expiresAt_idx" ON "Session"("userId", "revokedAt", "expiresAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "OtpChallenge_userId_createdAt_idx" ON "OtpChallenge"("userId", "createdAt");
CREATE INDEX "OtpChallenge_expiresAt_consumedAt_idx" ON "OtpChallenge"("expiresAt", "consumedAt");
CREATE UNIQUE INDEX "TrustedDevice_tokenHash_key" ON "TrustedDevice"("tokenHash");
CREATE INDEX "TrustedDevice_userId_revokedAt_expiresAt_idx" ON "TrustedDevice"("userId", "revokedAt", "expiresAt");
CREATE INDEX "TrustedDevice_expiresAt_idx" ON "TrustedDevice"("expiresAt");
CREATE INDEX "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt");
CREATE INDEX "AuditEvent_ipAddress_createdAt_idx" ON "AuditEvent"("ipAddress", "createdAt");
CREATE INDEX "AuditEvent_emailHash_createdAt_idx" ON "AuditEvent"("emailHash", "createdAt");
CREATE INDEX "AuditEvent_reason_createdAt_idx" ON "AuditEvent"("reason", "createdAt");
CREATE INDEX "RateLimitBucket_updatedAt_idx" ON "RateLimitBucket"("updatedAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
