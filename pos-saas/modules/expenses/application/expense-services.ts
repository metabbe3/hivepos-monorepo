import type { ExpenseRepository, ExpenseWithCategory } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesInput,
  ExpenseDTO,
} from "./dto";

export class ListExpensesService {
  constructor(private repo: ExpenseRepository) {}

  async execute(input: ListExpensesInput, ctx: RequestContext): Promise<ExpenseDTO[]> {
    const records = await this.repo.findMany({
      branchId: ctx.branchId,
      categoryId: input.categoryId,
      from: input.from ? new Date(input.from) : undefined,
      to: input.to ? new Date(input.to) : undefined,
    });
    return records.map(toDTO);
  }
}

export class CreateExpenseService {
  constructor(private repo: ExpenseRepository) {}

  async execute(input: CreateExpenseInput, ctx: RequestContext): Promise<ExpenseDTO> {
    const record = await this.repo.create({
      amount: input.amount,
      description: input.description,
      date: new Date(input.date),
      categoryId: input.categoryId,
      branchId: ctx.branchId,
    });
    return toDTO(record);
  }
}

export class UpdateExpenseService {
  constructor(private repo: ExpenseRepository) {}

  async execute(
    id: string,
    input: UpdateExpenseInput,
    ctx: RequestContext,
  ): Promise<ExpenseDTO> {
    const { date, ...rest } = input;
    const record = await this.repo.update(id, ctx.branchId, {
      ...rest,
      ...(date ? { date: new Date(date) } : {}),
    });
    return toDTO(record);
  }
}

export class DeleteExpenseService {
  constructor(private repo: ExpenseRepository) {}

  async execute(id: string, ctx: RequestContext): Promise<void> {
    await this.repo.delete(id, ctx.branchId);
  }
}

function toDTO(e: ExpenseWithCategory): ExpenseDTO {
  return {
    id: e.id,
    amount: e.amount,
    description: e.description,
    date: e.date.toISOString(),
    categoryId: e.categoryId,
    createdAt: e.createdAt.toISOString(),
    category: e.category
      ? {
          id: e.category.id,
          name: e.category.name,
          description: e.category.description,
        }
      : null,
  };
}
