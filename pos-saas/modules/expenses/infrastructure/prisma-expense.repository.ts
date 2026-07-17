import { prisma } from "@/lib/prisma";
import { decimalToNumberRequired } from "@/modules/shared/serialization";
import type {
  ExpenseRepository,
  ExpenseWithCategory,
  ListExpensesQuery,
  CreateExpenseData,
  UpdateExpenseData,
} from "../domain/repository.port";

function mapExpenseWithCategory(e: any): ExpenseWithCategory {
  return {
    id: e.id,
    amount: decimalToNumberRequired(e.amount),
    description: e.description,
    date: e.date,
    branchId: e.branchId,
    categoryId: e.categoryId,
    createdAt: e.createdAt,
    category: e.category
      ? {
          id: e.category.id,
          name: e.category.name,
          description: e.category.description,
          branchId: e.category.branchId,
          createdAt: e.category.createdAt,
        }
      : null,
  };
}

export class PrismaExpenseRepository implements ExpenseRepository {
  async findMany(query: ListExpensesQuery): Promise<ExpenseWithCategory[]> {
    const where: Record<string, unknown> = { branchId: query.branchId };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.from || query.to) {
      where.date = {};
      if (query.from) (where.date as any).gte = query.from;
      if (query.to) (where.date as any).lte = query.to;
    }

    const rows = await prisma.expense.findMany({
      where,
      include: { category: true },
      orderBy: { date: "desc" },
    });
    return rows.map(mapExpenseWithCategory);
  }

  async create(data: CreateExpenseData): Promise<ExpenseWithCategory> {
    const e = await prisma.expense.create({
      data: {
        amount: data.amount,
        description: data.description,
        date: data.date,
        categoryId: data.categoryId,
        branchId: data.branchId,
      },
      include: { category: true },
    });
    return mapExpenseWithCategory(e);
  }

  async update(id: string, branchId: string, data: UpdateExpenseData): Promise<ExpenseWithCategory> {
    const e = await prisma.expense.update({
      where: { id, branchId },
      data,
      include: { category: true },
    });
    return mapExpenseWithCategory(e);
  }

  async delete(id: string, branchId: string): Promise<void> {
    await prisma.expense.delete({ where: { id, branchId } });
  }
}
