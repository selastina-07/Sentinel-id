import "server-only";
import { db } from "@/lib/db";
import { hashEmail } from "@/lib/security/auth";
import type { RequestContext } from "@/lib/security/request-context";
import type { AuditOutcome, AuditReason } from "@prisma/client";

export async function recordAudit(input: {
  userId?: string | null;
  email?: string;
  context: RequestContext;
  outcome: AuditOutcome;
  reason: AuditReason;
  trusted?: boolean;
  sessionId?: string | null;
  trustedDeviceId?: string | null;
}) {
  await db.auditEvent.create({
    data: {
      userId: input.userId ?? null,
      emailHash: input.email ? hashEmail(input.email) : null,
      sessionId: input.sessionId ?? null,
      trustedDeviceId: input.trustedDeviceId ?? null,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      browser: input.context.browser,
      operatingSystem: input.context.operatingSystem,
      deviceCategory: input.context.deviceCategory,
      deviceModel: input.context.deviceModel,
      city: input.context.city,
      region: input.context.region,
      country: input.context.country,
      outcome: input.outcome,
      reason: input.reason,
      trusted: input.trusted ?? false,
    },
  });
}
