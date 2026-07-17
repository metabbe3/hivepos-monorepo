import { NotFoundError } from "@/modules/shared";
import type { ServiceRepository, ServiceWithGroup } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type {
  CreateServiceInput,
  UpdateServiceInput,
  ListServicesInput,
  ServiceDTO,
} from "./dto";

export class ListServicesService {
  constructor(private repo: ServiceRepository) {}

  async execute(input: ListServicesInput, ctx: RequestContext): Promise<ServiceDTO[]> {
    const records = await this.repo.findMany({
      branchId: ctx.branchId,
      module: ctx.activeModule,
      includeInactive: input.includeInactive,
    });

    return records.map(toDTO);
  }
}

export class CreateServiceService {
  constructor(private repo: ServiceRepository) {}

  async execute(input: CreateServiceInput, ctx: RequestContext): Promise<ServiceDTO> {
    const data = {
      ...input,
      module: ctx.activeModule,
      branchId: ctx.branchId,
    };

    // Check for an existing soft-deleted service with the same name
    const existing = await this.repo.findInactiveByName(input.name, ctx.branchId);

    const record = existing
      ? await this.repo.reactivate(existing.id, data)
      : await this.repo.create(data);

    return toDTO(record);
  }
}

export class UpdateServiceService {
  constructor(private repo: ServiceRepository) {}

  async execute(
    id: string,
    input: UpdateServiceInput,
    ctx: RequestContext,
  ): Promise<ServiceDTO> {
    const record = await this.repo.update(id, ctx.branchId, input);
    return toDTO(record);
  }
}

export class DeleteServiceService {
  constructor(private repo: ServiceRepository) {}

  async execute(id: string, ctx: RequestContext): Promise<void> {
    // Verify ownership before soft-deleting
    const all = await this.repo.findMany({
      branchId: ctx.branchId,
      module: ctx.activeModule,
      includeInactive: true,
    });
    if (!all.some((s) => s.id === id)) {
      throw new NotFoundError("Service not found");
    }

    await this.repo.softDelete(id, ctx.branchId);
  }
}

// ── Mapping helper ─────────────────────────────────────────────────────

function toDTO(s: ServiceWithGroup): ServiceDTO {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    pricingType: s.pricingType,
    basePrice: s.basePrice,
    commissionType: s.commissionType,
    commissionValue: s.commissionValue,
    module: s.module,
    isActive: s.isActive,
    isDefaultSpeed: s.isDefaultSpeed,
    groupId: s.groupId,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    group: s.group,
  };
}
