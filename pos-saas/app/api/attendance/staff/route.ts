import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";

// Staff eligible to clock (active + has a clock PIN), for the name grid.
export const GET = withErrorHandler(async () => {
  const ctx = await requirePermissionOrThrow("attendance", "read");
  const staff = await prisma.user.findMany({
    where: { tenantId: ctx.tenantId, isActive: true, pinHash: { not: null } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return apiSuccess(staff);
});
