import { NotFoundError } from "@/modules/shared";
import type { StockItemRepository, StockItemWithCount } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type {
  CreateStockItemInput,
  UpdateStockItemInput,
  StockItemDTO,
} from "./dto";

export class ListStockItemsService {
  constructor(private repo: StockItemRepository) {}

  async execute(ctx: RequestContext): Promise<StockItemDTO[]> {
    const records = await this.repo.findMany({
      branchId: ctx.branchId,
    });
    return records.map(toDTO);
  }
}

export class CreateStockItemService {
  constructor(private repo: StockItemRepository) {}

  async execute(input: CreateStockItemInput, ctx: RequestContext): Promise<StockItemDTO> {
    const record = await this.repo.create({
      ...input,
      branchId: ctx.branchId,
    });

    return { ...toDTO({ ...record, movementCount: 0 }) };
  }
}

export class UpdateStockItemService {
  constructor(private repo: StockItemRepository) {}

  async execute(
    id: string,
    input: UpdateStockItemInput,
    ctx: RequestContext,
  ): Promise<StockItemDTO> {
    const record = await this.repo.update(id, ctx.branchId, input);
    return toDTO({ ...record, movementCount: 0 });
  }
}

export class DeleteStockItemService {
  constructor(private repo: StockItemRepository) {}

  async execute(id: string, ctx: RequestContext): Promise<void> {
    const existing = await this.repo.findById(id, ctx.branchId);
    if (!existing) {
      throw new NotFoundError("Stock item not found");
    }
    await this.repo.softDelete(id, ctx.branchId);
  }
}

function toDTO(s: StockItemWithCount): StockItemDTO {
  return {
    id: s.id,
    name: s.name,
    unit: s.unit,
    currentQuantity: s.currentQuantity,
    lowStockThreshold: s.lowStockThreshold,
    purchasePricePerUnit: s.purchasePricePerUnit,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    movementCount: s.movementCount,
  };
}
