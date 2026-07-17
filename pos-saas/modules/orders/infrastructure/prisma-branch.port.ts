import { prisma } from "@/lib/prisma";
import type { BranchPort, BranchCoverageInfo } from "../application/ports";

export class PrismaBranchPort implements BranchPort {
  async getCoverage(branchId: string): Promise<BranchCoverageInfo | null> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, isFreeTier: true, coverageEnd: true },
    });

    return branch;
  }
}
