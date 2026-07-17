import { prisma } from "@/lib/prisma";
import { withErrorHandler, apiSuccess } from "@/modules/shared";

export const GET = withErrorHandler(async () => {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ groupId: "asc" }, { name: "asc" }],
    select: {
      name: true,
      description: true,
      pricingType: true,
      basePrice: true,
      group: { select: { id: true, name: true } },
    },
  });

  return apiSuccess(
    services.map((s) => ({
      name: s.name,
      description: s.description,
      pricingType: s.pricingType,
      basePrice: Number(s.basePrice),
      group: s.group ? { name: s.group.name } : null,
    }))
  );
});
