import { prisma } from "@/lib/prisma";
import type { CustomerLookupPort } from "../application/ports";

export class PrismaCustomerLookupPort implements CustomerLookupPort {
  async existsInBranch(customerId: string, branchId: string): Promise<boolean> {
    const row = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { branchId: true },
    });
    return row?.branchId === branchId;
  }
}
