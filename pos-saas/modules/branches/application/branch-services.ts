import { Prisma } from "@/lib/prisma";
import type { BranchRepository } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type { BranchInput, BranchListItemDTO, BranchDetailDTO } from "./dto";
import { NotFoundError, toIso, toIsoRequired } from "@/modules/shared";

export class ListBranchesService {
  constructor(private repo: BranchRepository) {}

  async execute(ctx: RequestContext): Promise<BranchListItemDTO[]> {
    // Defense: if tenantId is missing, return empty rather than crashing Prisma.
    if (!ctx.tenantId) return [];
    const branches = await this.repo.findMany(ctx.tenantId);
    return branches.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      phone: b.phone,
      isActive: b.isActive,
      isFreeTier: b.isFreeTier,
      coverageEnd: toIso(b.coverageEnd),
      createdAt: toIsoRequired(b.createdAt),
      counts: b.counts,
    }));
  }
}

export class GetBranchService {
  constructor(private repo: BranchRepository) {}

  async execute(id: string, ctx: RequestContext): Promise<BranchDetailDTO> {
    const branch = await this.repo.findDetailById(id, ctx.tenantId);
    if (!branch) throw new NotFoundError("Branch", id);

    return {
      id: branch.id,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      invoiceFooter: branch.invoiceFooter,
      latitude: branch.latitude,
      longitude: branch.longitude,
      googleMapsLink: branch.googleMapsLink,
      whatsappLink: branch.whatsappLink,
      operatingHours: branch.operatingHours,
      printerHost: branch.printerHost,
      printerPort: branch.printerPort,
      printerName: branch.printerName,
      printerEnabled: branch.printerEnabled,
      printerPaperSize: branch.printerPaperSize,
      isActive: branch.isActive,
      isFreeTier: branch.isFreeTier,
      coverageEnd: toIso(branch.coverageEnd),
      createdAt: toIsoRequired(branch.createdAt),
      users: branch.users,
      counts: branch.counts,
    };
  }
}

export class CreateBranchService {
  constructor(private repo: BranchRepository) {}

  async execute(input: BranchInput, ctx: RequestContext): Promise<{ id: string }> {
    // First outlet per tenant is free tier; others need payment
    const existingCount = await this.repo.count(ctx.tenantId);
    const isFreeTier = existingCount === 0;

    const { operatingHours, ...rest } = input;

    return this.repo.create({
      ...rest,
      operatingHours,
      tenantId: ctx.tenantId,
      isFreeTier,
    });
  }
}

export class UpdateBranchService {
  constructor(private repo: BranchRepository) {}

  async execute(
    id: string,
    input: Partial<BranchInput>,
    ctx: RequestContext,
  ): Promise<{ id: string }> {
    // Verify ownership
    const existing = await this.repo.findDetailById(id, ctx.tenantId);
    if (!existing) throw new NotFoundError("Branch", id);

    const { operatingHours, ...rest } = input;

    const data: Record<string, unknown> = { ...rest };
    if (operatingHours !== undefined) {
      data.operatingHours =
        operatingHours === null ? Prisma.JsonNull : operatingHours;
    }

    return this.repo.update(id, data);
  }
}
