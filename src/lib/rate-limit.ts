/**
 * Fixed-window in-memory rate limiter.
 *
 * MVP-appropriate for a single Next.js instance. It is NOT correct across
 * multiple server instances (each process has its own counters) — the P1
 * upgrade path is a shared store (Upstash Redis / `@upstash/ratelimit`),
 * swapped in behind the same `checkRateLimit` signature. Flagged here and in
 * docs/SECURITY.md so it isn't mistaken for a distributed limiter.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodically drop expired buckets so this doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref?.();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/** `key` should already include the scope, e.g. `login:${ip}` or `scan:${tokenId}:${ipHash}`. */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}
