import bcrypt from "bcrypt";
import { withErrorHandler, apiCreated, ValidationError } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ponytail: in-memory PIN rate-limit. Fine for a single container; move to Redis
// if we ever run multiple app instances behind a load balancer.
const attempts = new Map<string, { fails: number; until: number }>();
const MAX_FAILS = 5;
const COOLDOWN_MS = 60_000;

const bodySchema = z
  .object({
    userId: z.string().uuid().optional(),
    pin: z.string().min(4).max(4).optional(),
    qrToken: z.string().min(8).optional(),
  })
  .refine((d) => (d.userId && d.pin) || d.qrToken, {
    message: "userId+pin or qrToken required",
  });

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("attendance", "read");
  if (ctx.branchId === "ALL") {
    throw new ValidationError("Pick a specific outlet before clocking.");
  }
  const parsed = bodySchema.parse(await req.json());

  // Resolve the staff by QR token (no PIN) OR by userId + PIN verify.
  let user: { id: string; name: string; pinHash: string | null } | null = null;
  if (parsed.qrToken) {
    user = await prisma.user.findFirst({
      where: { tenantId: ctx.tenantId, qrToken: parsed.qrToken, isActive: true },
      select: { id: true, name: true, pinHash: true },
    });
    if (!user) throw new ValidationError("Staff not found");
  } else {
    const key = parsed.userId!;
    const a = attempts.get(key);
    if (a && Date.now() < a.until) throw new ValidationError("Too many tries. Wait a moment.");
    user = await prisma.user.findFirst({
      where: { id: key, tenantId: ctx.tenantId, isActive: true, pinHash: { not: null } },
      select: { id: true, name: true, pinHash: true },
    });
    if (!user || !user.pinHash || !(await bcrypt.compare(parsed.pin!, user.pinHash))) {
      const fails = (a?.fails ?? 0) + 1;
      attempts.set(key, {
        fails,
        until: fails >= MAX_FAILS ? Date.now() + COOLDOWN_MS : a?.until ?? 0,
      });
      throw new ValidationError("Wrong PIN");
    }
    attempts.delete(key); // success clears the counter
  }

  // Toggle + forgot-clock-out guard.
  const last = await prisma.clockEvent.findFirst({
    where: { userId: user.id },
    orderBy: { timestamp: "desc" },
  });
  const now = new Date();
  let type: "CLOCK_IN" | "CLOCK_OUT" = "CLOCK_IN";
  let autoClosed = false;
  let sessionMs: number | undefined;
  if (last?.type === "CLOCK_IN") {
    const sameDay = last.timestamp.toDateString() === now.toDateString();
    if (sameDay) {
      type = "CLOCK_OUT";
      sessionMs = now.getTime() - last.timestamp.getTime();
    } else {
      // Stale open IN from a previous day → auto-close at end of that day, then a fresh IN.
      const endOf = new Date(last.timestamp);
      endOf.setHours(23, 59, 0, 0);
      await prisma.clockEvent.create({
        data: { userId: user.id, tenantId: ctx.tenantId, branchId: last.branchId, type: "CLOCK_OUT", timestamp: endOf },
      });
      autoClosed = true;
      type = "CLOCK_IN";
    }
  }
  const ev = await prisma.clockEvent.create({
    data: { userId: user.id, tenantId: ctx.tenantId, branchId: ctx.branchId, type, timestamp: now },
  });
  return apiCreated({ ...ev, userName: user.name, autoClosed, sessionMs });
});
