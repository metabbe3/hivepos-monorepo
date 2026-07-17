import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";

// Onboarding progress: which setup steps are already done?
export const GET = withErrorHandler(async () => {
  const ctx = await requirePermissionOrThrow("dashboard", "read");

  const [serviceCount, branch, customerCount, orderCount] = await Promise.all([
    prisma.service.count({ where: { branch: { tenantId: ctx.tenantId } } }),
    prisma.branch.findFirst({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: { address: true, phone: true },
    }),
    prisma.customer.count({ where: { branch: { tenantId: ctx.tenantId } } }),
    prisma.order.count({ where: { customer: { branch: { tenantId: ctx.tenantId } } } }),
  ]);

  const servicesExist = serviceCount > 0;
  const outletConfigured = !!(branch?.address || branch?.phone);
  const customersExist = customerCount > 0;
  const firstOrderPlaced = orderCount > 0;

  const steps = [servicesExist, outletConfigured, customersExist, firstOrderPlaced];
  const done = steps.filter(Boolean).length;
  const percent = Math.round((done / steps.length) * 100);

  return apiSuccess({
    servicesExist,
    outletConfigured,
    customersExist,
    firstOrderPlaced,
    done,
    total: steps.length,
    percent,
  });
});
