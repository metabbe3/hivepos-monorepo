import { withErrorHandler, apiSuccess, apiCreated, ValidationError } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Owner/Manager override: list + manually add clock events.

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("attendance", "read");
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const userId = url.searchParams.get("userId");
  const start = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = to ? new Date(to + "T23:59:59") : new Date();

  const events = await prisma.clockEvent.findMany({
    where: {
      tenantId: ctx.tenantId,
      branchId: { in: ctx.branchIds },
      timestamp: { gte: start, lte: end },
      ...(userId ? { userId } : {}),
    },
    include: { user: { select: { name: true } }, branch: { select: { name: true } } },
    orderBy: { timestamp: "desc" },
    take: 500,
  });

  return apiSuccess(events.map((e) => ({
    id: e.id,
    userId: e.userId,
    userName: e.user.name,
    type: e.type,
    timestamp: e.timestamp.toISOString(),
    branchId: e.branchId,
    branchName: e.branch.name,
  })));
});

const addSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  timestamp: z.string().datetime(),
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("attendance", "edit");
  if (ctx.branchId === "ALL") throw new ValidationError("Pick a specific outlet.");
  const parsed = addSchema.parse(await req.json());

  const user = await prisma.user.findFirst({
    where: { id: parsed.userId, tenantId: ctx.tenantId },
    select: { id: true, name: true },
  });
  if (!user) throw new ValidationError("Staff not found");

  const ev = await prisma.clockEvent.create({
    data: {
      userId: parsed.userId,
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      type: parsed.type,
      timestamp: new Date(parsed.timestamp),
    },
    include: { user: { select: { name: true } }, branch: { select: { name: true } } },
  });

  return apiCreated({
    id: ev.id,
    userId: ev.userId,
    userName: ev.user.name,
    type: ev.type,
    timestamp: ev.timestamp.toISOString(),
    branchId: ev.branchId,
    branchName: ev.branch.name,
  });
});
