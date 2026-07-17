import { BusinessRuleError } from "@/modules/shared";
import type { ExpenseCategoryRepository, ExpenseCategoryRecord } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  ExpenseCategoryDTO,
} from "./dto";

export class ListExpenseCategoriesService {
  constructor(private repo: ExpenseCategoryRepository) {}

  async execute(ctx: RequestContext): Promise<ExpenseCategoryDTO[]> {
    const records = await this.repo.findMany(ctx.branchId);
    return records.map(toDTO);
  }
}

export class CreateExpenseCategoryService {
  constructor(private repo: ExpenseCategoryRepository) {}

  async execute(input: CreateCategoryInput, ctx: RequestContext): Promise<ExpenseCategoryDTO> {
    const record = await this.repo.create({
      name: input.name,
      description: input.description,
      branchId: ctx.branchId,
    });
    return toDTO(record);
  }
}

export class UpdateExpenseCategoryService {
  constructor(private repo: ExpenseCategoryRepository) {}

  async execute(
    id: string,
    input: UpdateCategoryInput,
    ctx: RequestContext,
  ): Promise<ExpenseCategoryDTO> {
    const record = await this.repo.update(id, ctx.branchId, input);
    return toDTO(record);
  }
}

export class DeleteExpenseCategoryService {
  constructor(private repo: ExpenseCategoryRepository) {}

  async execute(id: string, ctx: RequestContext): Promise<void> {
    const count = await this.repo.countExpenses(id);
    if (count > 0) {
      throw new BusinessRuleError("Kategori masih dipakai pengeluaran lain.");
    }
    await this.repo.delete(id, ctx.branchId);
  }
}

function toDTO(c: ExpenseCategoryRecord): ExpenseCategoryDTO {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    createdAt: c.createdAt.toISOString(),
  };
}
