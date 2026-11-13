import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Sliding-window rate limiter backed by Postgres so it holds across
 * serverless instances (an in-memory counter resets per cold start).
 * Keys are hashed so no e-mail addresses or IPs are stored in clear text.
 */

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export async function isRateLimited(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const count = await prisma.rateLimitHit.count({
    where: {
      key: hashKey(key),
      createdAt: { gte: new Date(Date.now() - windowMs) },
    },
  });
  return count >= limit;
}

export async function recordHit(key: string) {
  await prisma.rateLimitHit.create({ data: { key: hashKey(key) } });
  // Opportunistic cleanup keeps the table tiny without a cron job.
  if (Math.random() < 0.05) {
    await prisma.rateLimitHit
      .deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      })
      .catch(() => null);
  }
}

export async function clearHits(key: string) {
  await prisma.rateLimitHit.deleteMany({ where: { key: hashKey(key) } });
}

/** Check-and-count in one call: returns true when the caller is over the limit. */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (await isRateLimited(key, limit, windowMs)) return true;
  await recordHit(key);
  return false;
}

export function clientIp(source: Request | Headers | undefined | null): string {
  const headers = source instanceof Headers ? source : source?.headers;
  if (!headers) return "unknown";
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

export const MINUTE = 60 * 1000;
