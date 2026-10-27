import "server-only";
import { db } from "@/lib/db";

interface RateLimitRow {
  count: number;
}

export async function consumeRateLimit(
  keys: string[],
  limit: number,
  windowMs: number,
  now = new Date(),
): Promise<boolean> {
  return db.$transaction(async (transaction) => {
    let allowed = true;
    const windowStart = new Date(now.getTime() - windowMs);
    for (const key of new Set(keys)) {
      const [bucket] = await transaction.$queryRaw<RateLimitRow[]>`
        INSERT INTO "RateLimitBucket" ("key", "count", "windowStartedAt", "updatedAt")
        VALUES (${key}, 1, ${now}, ${now})
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE
            WHEN "RateLimitBucket"."windowStartedAt" <= ${windowStart} THEN 1
            ELSE LEAST("RateLimitBucket"."count" + 1, ${limit + 1})
          END,
          "windowStartedAt" = CASE
            WHEN "RateLimitBucket"."windowStartedAt" <= ${windowStart} THEN ${now}
            ELSE "RateLimitBucket"."windowStartedAt"
          END,
          "updatedAt" = ${now}
        RETURNING "count"
      `;
      if (!bucket || bucket.count > limit) allowed = false;
    }
    return allowed;
  });
}
