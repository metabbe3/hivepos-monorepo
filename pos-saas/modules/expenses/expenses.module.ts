import { PrismaExpenseRepository } from "./infrastructure/prisma-expense.repository";
import { PrismaExpenseCategoryRepository } from "./infrastructure/prisma-expense-category.repository";
import {
  ListExpensesService,
  CreateExpenseService,
  UpdateExpenseService,
  DeleteExpenseService,
} from "./application/expense-services";
import {
  ListExpenseCategoriesService,
  CreateExpenseCategoryService,
  UpdateExpenseCategoryService,
  DeleteExpenseCategoryService,
} from "./application/category-services";

// ── Infrastructure singletons ──────────────────────────────────────────
const expenseRepo = new PrismaExpenseRepository();
const categoryRepo = new PrismaExpenseCategoryRepository();

// ── Application service singletons ─────────────────────────────────────
export const listExpensesService = new ListExpensesService(expenseRepo);
export const createExpenseService = new CreateExpenseService(expenseRepo);
export const updateExpenseService = new UpdateExpenseService(expenseRepo);
export const deleteExpenseService = new DeleteExpenseService(expenseRepo);

export const listExpenseCategoriesService = new ListExpenseCategoriesService(categoryRepo);
export const createExpenseCategoryService = new CreateExpenseCategoryService(categoryRepo);
export const updateExpenseCategoryService = new UpdateExpenseCategoryService(categoryRepo);
export const deleteExpenseCategoryService = new DeleteExpenseCategoryService(categoryRepo);
