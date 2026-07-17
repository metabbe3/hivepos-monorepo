import { prisma } from "@/lib/prisma";
import { withErrorHandler, apiSuccess } from "@/modules/shared";

export const GET = withErrorHandler(async () => {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: {
      name: true,
      address: true,
      phone: true,
      latitude: true,
      longitude: true,
      operatingHours: true,
      whatsappLink: true,
      googleMapsLink: true,
    },
  });

  return apiSuccess(branches);
});
