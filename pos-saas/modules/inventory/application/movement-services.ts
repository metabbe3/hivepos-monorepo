import { NotFoundError, ValidationError } from "@/modules/shared";
import { canApplyMovement } from "../domain/stock-movement";
import type {
  StockItemRepository,
  StockMovementRepository,
  StockMovementRecord,
} from "../domain/repository.port";
import type { RequestContext } from "./context";
import type {
  CreateMovementInput,
  StockMovementDTO,
} from "./dto";

export class RecordMovementService {
  constructor(
    private movementRepo: StockMovementRepository,
    private stockItemRepo: StockItemRepository,
  ) {}

  async execute(
    stockItemId: string,
    input: CreateMovementInput,
    ctx: RequestContext,
  ): Promise<StockMovementDTO> {
    const item = await this.stockItemRepo.findById(stockItemId, ctx.branchId);
    if (!item) {
      throw new NotFoundError("Stock item not found");
    }

    if (!canApplyMovement(item.currentQuantity, input.type, input.quantity)) {
      throw new ValidationError(
        `Insufficient stock. Current quantity: ${item.currentQuantity}`,
      );
    }

    const record = await this.movementRepo.recordMovement(stockItemId, {
      stockItemId,
      type: input.type,
      quantity: input.quantity,
      notes: input.notes,
      date: new Date(input.date),
    });

    return toDTO(record);
  }
}

export class ListMovementsService {
  constructor(
    private movementRepo: StockMovementRepository,
    private stockItemRepo: StockItemRepository,
  ) {}

  async execute(
    stockItemId: string,
    ctx: RequestContext,
  ): Promise<StockMovementDTO[]> {
    const item = await this.stockItemRepo.findById(stockItemId, ctx.branchId);
    if (!item) {
      throw new NotFoundError("Stock item not found");
    }

    const records = await this.movementRepo.findMany(stockItemId);
    return records.map(toDTO);
  }
}

function toDTO(m: StockMovementRecord): StockMovementDTO {
  return {
    id: m.id,
    stockItemId: m.stockItemId,
    type: m.type,
    quantity: m.quantity,
    date: m.date.toISOString(),
    notes: m.notes,
    createdAt: m.createdAt.toISOString(),
  };
}
