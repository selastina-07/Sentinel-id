import type { Prisma } from "@prisma/client";

export function ownedActiveSessionWhere(
  userId: string,
  sessionId: string,
  now: Date,
): Prisma.SessionWhereInput {
  return {
    userId,
    id: sessionId,
    revokedAt: null,
    expiresAt: { gt: now },
  };
}

export function ownedActiveTrustedDeviceWhere(
  userId: string,
  deviceId: string,
): Prisma.TrustedDeviceWhereInput {
  return {
    userId,
    id: deviceId,
    revokedAt: null,
  };
}
