import { prisma } from "@/lib/prisma";
import type {
  ExpenseCategoryRepository,
  ExpenseCategoryRecord,
  CreateCategoryData,
  UpdateCategoryData,
} from "../domain/repository.port";

function mapRecord(c: any): ExpenseCategoryRecord {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    branchId: c.branchId,
    createdAt: c.createdAt,
  };
}

export class PrismaExpenseCategoryRepository implements ExpenseCategoryRepository {
  async findMany(branchId: string): Promise<ExpenseCategoryRecord[]> {
    const rows = await prisma.expenseCategory.findMany({
      where: { branchId },
      orderBy: { name: "asc" },
    });
    return rows.map(mapRecord);
  }

  async create(data: CreateCategoryData): Promise<ExpenseCategoryRecord> {
    const c = await prisma.expenseCategory.create({
      data: {
        name: data.name,
        description: data.description,
        branchId: data.branchId,
      },
    });
    return mapRecord(c);
  }

  async update(id: string, branchId: string, data: UpdateCategoryData): Promise<ExpenseCategoryRecord> {
    const c = await prisma.expenseCategory.update({
      where: { id, branchId },
      data,
    });
    return mapRecord(c);
  }

  async delete(id: string, branchId: string): Promise<void> {
    await prisma.expenseCategory.delete({ where: { id, branchId } });
  }

  async countExpenses(categoryId: string): Promise<number> {
    return prisma.expense.count({ where: { categoryId } });
  }
}
