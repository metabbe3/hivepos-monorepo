import { prisma } from "@/lib/prisma";
import type { ServiceCatalogPort } from "../application/ports";
import type { ServicePricing } from "../domain/types";

export class PrismaServiceCatalog implements ServiceCatalogPort {
  async findPricingForServices(
    ids: string[],
    branchIds: string[],
  ): Promise<ServicePricing[]> {
    const rows = await prisma.service.findMany({
      where: {
        id: { in: ids },
        branchId: { in: branchIds },
      },
      select: {
        id: true,
        basePrice: true,
        pricingType: true,
        module: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      basePrice: Number(r.basePrice),
      pricingType: r.pricingType as ServicePricing["pricingType"],
      module: r.module as ServicePricing["module"],
    }));
  }
}
