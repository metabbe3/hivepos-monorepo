import { prisma } from "@/lib/prisma";
import type { BranchPort, BranchSnapshot } from "../domain/repository.port";

/** Prisma-backed BranchPort — resolves branches by slug (public) or id (staff). */
export class PrismaBranchPort implements BranchPort {
  async findBySlug(slug: string): Promise<BranchSnapshot | null> {
    // findFirst (not findUnique) so we can filter by isActive — deactivated
    // branches should not accept new pickup submissions.
    const branch = await prisma.branch.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        tenantId: true,
        slug: true,
        pickupSlots: true,
      },
    });
    if (!branch || !branch.slug) return null;
    // Default module to LAUNDRY when the tenant hasn't configured multi-module.
    return {
      id: branch.id,
      tenantId: branch.tenantId,
      slug: branch.slug,
      pickupSlots: branch.pickupSlots,
      module: "LAUNDRY",
    };
  }

  async findById(id: string): Promise<BranchSnapshot | null> {
    const branch = await prisma.branch.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        slug: true,
        pickupSlots: true,
      },
    });
    if (!branch) return null;
    return {
      id: branch.id,
      tenantId: branch.tenantId,
      slug: branch.slug,
      pickupSlots: branch.pickupSlots,
      module: "LAUNDRY",
    };
  }
}
