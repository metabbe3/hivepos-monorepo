// ── Persistence shapes ─────────────────────────────────────────────────

export interface ExpenseCategoryRecord {
  id: string;
  name: string;
  description: string | null;
  branchId: string;
  createdAt: Date;
}

export interface ExpenseRecord {
  id: string;
  amount: number;
  description: string | null;
  date: Date;
  branchId: string;
  categoryId: string | null;
  createdAt: Date;
}

export interface ExpenseWithCategory extends ExpenseRecord {
  category: ExpenseCategoryRecord | null;
}

// ── Query/input shapes ────────────────────────────────────────────────

export interface ListExpensesQuery {
  branchId: string;
  categoryId?: string;
  from?: Date;
  to?: Date;
}

export interface CreateExpenseData {
  amount: number;
  description?: string;
  date: Date;
  categoryId?: string | null;
  branchId: string;
}

export interface UpdateExpenseData {
  amount?: number;
  description?: string;
  date?: Date;
  categoryId?: string | null;
}

export interface CreateCategoryData {
  name: string;
  description?: string | null;
  branchId: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string | null;
}

// ── Repository ports ───────────────────────────────────────────────────

export interface ExpenseRepository {
  findMany(query: ListExpensesQuery): Promise<ExpenseWithCategory[]>;
  create(data: CreateExpenseData): Promise<ExpenseWithCategory>;
  update(id: string, branchId: string, data: UpdateExpenseData): Promise<ExpenseWithCategory>;
  delete(id: string, branchId: string): Promise<void>;
}

export interface ExpenseCategoryRepository {
  findMany(branchId: string): Promise<ExpenseCategoryRecord[]>;
  create(data: CreateCategoryData): Promise<ExpenseCategoryRecord>;
  update(id: string, branchId: string, data: UpdateCategoryData): Promise<ExpenseCategoryRecord>;
  delete(id: string, branchId: string): Promise<void>;
  countExpenses(categoryId: string): Promise<number>;
}
