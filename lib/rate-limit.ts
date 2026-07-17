import { headers } from "next/headers";
import { RateLimitError } from "@/modules/shared";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store — resets on server restart (acceptable for rate limiting)
// ponytail: per-instance Map. At >1 replica, swap for Redis-backed store.
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/**
 * IP-keyed rate limiter. Throws RateLimitError when the window is exceeded,
 * otherwise returns void. Shared by NextRequest handlers and callers without
 * a request object (e.g. NextAuth's authorize()).
 *
 * Usage:
 *   rateLimitByIp(ip, pathname, { limit: 10, windowSeconds: 60 });
 */
export function rateLimitByIp(
  ip: string,
  pathname: string,
  opts: RateLimitOptions = { limit: 10, windowSeconds: 60 },
): void {
  const key = `${ip}:${pathname}`;
  const now = Date.now();
  const resetAt = now + opts.windowSeconds * 1000;

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt });
    return;
  }

  entry.count++;

  if (entry.count > opts.limit) {
    throw new RateLimitError();
  }
}

/**
 * Rate limiter for API routes. Reads IP + pathname from the request, throws
 * RateLimitError (caught by withErrorHandler → 429 envelope) on limit hit.
 *
 * Usage:
 *   rateLimit(req, { limit: 5, windowSeconds: 60 });
 */
export function rateLimit(
  req: Request,
  opts: RateLimitOptions = { limit: 10, windowSeconds: 60 },
): void {
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const pathname = new URL(req.url).pathname;
  rateLimitByIp(ip, pathname, opts);
}

/**
 * Read request IP from next/headers (for use inside NextAuth callbacks
 * where no NextRequest is available).
 */
export async function getRequestIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}
