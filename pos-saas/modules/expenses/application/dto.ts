export interface CreateExpenseInput {
  amount: number;
  description?: string;
  date: string;
  categoryId?: string | null;
}

export interface UpdateExpenseInput {
  amount?: number;
  description?: string;
  date?: string;
  categoryId?: string | null;
}

export interface ListExpensesInput {
  categoryId?: string;
  from?: string;
  to?: string;
}

export interface ExpenseDTO {
  id: string;
  amount: number;
  description: string | null;
  date: string;
  categoryId: string | null;
  createdAt: string;
  category: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
}

export interface ExpenseCategoryDTO {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}
