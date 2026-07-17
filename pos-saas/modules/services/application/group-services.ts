import { NotFoundError, ValidationError } from "@/modules/shared";
import type { ServiceGroupRepository } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type {
  CreateGroupInput,
  UpdateGroupInput,
  ReorderGroupsInput,
  ServiceGroupDTO,
} from "./dto";

export class ListServiceGroupsService {
  constructor(private repo: ServiceGroupRepository) {}

  async execute(ctx: RequestContext): Promise<ServiceGroupDTO[]> {
    const records = await this.repo.findMany({
      branchId: ctx.branchId,
      module: ctx.activeModule,
    });

    return records.map(toDTO);
  }
}

export class CreateServiceGroupService {
  constructor(private repo: ServiceGroupRepository) {}

  async execute(input: CreateGroupInput, ctx: RequestContext): Promise<ServiceGroupDTO> {
    const sortOrder =
      input.sortOrder ?? (await this.repo.getMaxSortOrder(ctx.branchId, ctx.activeModule)) + 1;

    const record = await this.repo.create({
      name: input.name,
      description: input.description,
      sortOrder,
      module: ctx.activeModule,
      branchId: ctx.branchId,
    });

    return toDTO({ ...record, serviceCount: 0 });
  }
}

export class UpdateServiceGroupService {
  constructor(private repo: ServiceGroupRepository) {}

  async execute(
    id: string,
    input: UpdateGroupInput,
    ctx: RequestContext,
  ): Promise<ServiceGroupDTO> {
    const existing = await this.repo.findById(id, ctx.branchId);
    if (!existing) {
      throw new NotFoundError("Service group not found");
    }

    const record = await this.repo.update(id, input);

    // Re-fetch count
    const all = await this.repo.findMany({
      branchId: ctx.branchId,
      module: ctx.activeModule,
    });
    const withCount = all.find((g) => g.id === id);

    return toDTO(withCount ?? { ...record, serviceCount: 0 });
  }
}

export class DeleteServiceGroupService {
  constructor(private repo: ServiceGroupRepository) {}

  async execute(id: string, ctx: RequestContext): Promise<void> {
    const existing = await this.repo.findById(id, ctx.branchId);
    if (!existing) {
      throw new NotFoundError("Service group not found");
    }

    // Detach all services from this group, then delete
    await this.repo.ungroupServices(id);
    await this.repo.delete(id);
  }
}

export class ReorderServiceGroupsService {
  constructor(private repo: ServiceGroupRepository) {}

  async execute(input: ReorderGroupsInput, ctx: RequestContext): Promise<void> {
    if (input.groups.length === 0) {
      throw new ValidationError("Pilih minimal satu grup.");
    }

    const ids = input.groups.map((g) => g.id);
    const owned = await this.repo.countByIds(ids, ctx.branchId);
    if (owned !== ids.length) {
      throw new NotFoundError("One or more service groups not found");
    }

    await this.repo.reorder(input.groups);
  }
}

// ── Mapping helper ─────────────────────────────────────────────────────

function toDTO(g: {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  module: string;
  createdAt: Date;
  updatedAt: Date;
  serviceCount: number;
}): ServiceGroupDTO {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    sortOrder: g.sortOrder,
    module: g.module,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    serviceCount: g.serviceCount,
  };
}
