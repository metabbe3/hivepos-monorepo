import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";

// All clock-eligible staff + their status for the kiosk grid:
// { id, name, since (null if clocked out), todayMs (worked-hours-today incl. open session) }
export const GET = withErrorHandler(async () => {
  const ctx = await requireWithBranchOrThrow("attendance", "read");
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const now = new Date();

  const users = await prisma.user.findMany({
    where: { tenantId: ctx.tenantId, isActive: true, pinHash: { not: null } },
    select: {
      id: true,
      name: true,
      clockEvents: {
        where: { timestamp: { gte: startOfToday }, branchId: { in: ctx.branchIds } },
        orderBy: { timestamp: "asc" },
      },
    },
  });

  const rows = users.map((u) => {
    let todayMs = 0;
    let openIn: Date | null = null;
    for (const ev of u.clockEvents) {
      if (ev.type === "CLOCK_IN") {
        openIn = ev.timestamp;
      } else if (ev.type === "CLOCK_OUT" && openIn) {
        todayMs += ev.timestamp.getTime() - openIn.getTime();
        openIn = null;
      }
    }
    // Add the open session up to now if currently clocked in.
    if (openIn) todayMs += now.getTime() - openIn.getTime();
    return { id: u.id, name: u.name, since: openIn ? openIn.toISOString() : null, todayMs };
  });

  return apiSuccess(rows);
});
