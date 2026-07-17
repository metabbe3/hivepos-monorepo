import { getApiSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  UnauthenticatedError,
  RateLimitError,
  ValidationError,
} from "@/modules/shared";
import { isTelemetryKind } from "@/lib/telemetry";

// ponytail: simple in-memory rate limit per user. Ceiling: resets on server
// restart, not shared across worker processes. Fine for early volume — a
// single malicious user can't exhaust DB writes. Upgrade path: Redis sliding
// window when this becomes a real backend (tenant count > 1000).
const RATE_LIMIT_MAX = 100; // events per minute per user
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(userId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

// Garbage-collect expired buckets every ~5 min to avoid unbounded Map growth.
// ponytail: lazy GC — cheap O(1) per request, periodic sweep.
let lastGc = Date.now();
function gcBuckets() {
  const now = Date.now();
  if (now - lastGc < 5 * 60_000) return;
  lastGc = now;
  for (const [k, v] of rateBuckets) if (now > v.resetAt) rateBuckets.delete(k);
}

const MAX_BATCH = 50;

export const POST = withErrorHandler(async (req: Request) => {
  // getApiSession() (bearer-aware) so mobile clients can report telemetry.
  const session = await getApiSession();
  const userId = session?.user?.id;
  const tenantId = (session?.user as { tenantId?: string } | undefined)?.tenantId ?? null;
  if (!userId) {
    throw new UnauthenticatedError();
  }

  gcBuckets();
  if (!rateLimit(userId)) {
    throw new RateLimitError("Telemetry rate limit exceeded");
  }

  const body = (await req.json().catch(() => null)) as
    | { events?: unknown[] }
    | null;
  const events = Array.isArray(body?.events) ? body!.events : [];
  if (events.length === 0) return apiSuccess({ accepted: 0 });
  if (events.length > MAX_BATCH) {
    throw new ValidationError(`Batch exceeds max of ${MAX_BATCH} events`);
  }

  // Validate + filter. Drop invalid kinds silently — one bad payload from one
  // client shouldn't fail the whole batch.
  const rows: Array<{
    tenantId: string | null;
    userId: string;
    kind: string;
    payload: unknown;
  }> = [];
  for (const e of events) {
    if (!e || typeof e !== "object") continue;
    const { kind, payload } = e as { kind?: unknown; payload?: unknown };
    if (!isTelemetryKind(kind)) continue;
    if (payload === undefined || payload === null) continue;
    rows.push({ tenantId, userId, kind, payload });
  }

  if (rows.length === 0) return apiSuccess({ accepted: 0 });

  await prisma.telemetryEvent.createMany({
    data: rows.map((r) => ({
      tenantId: r.tenantId,
      userId: r.userId,
      kind: r.kind,
      payload: r.payload as object,
    })),
  });

  return apiSuccess({ accepted: rows.length });
});
