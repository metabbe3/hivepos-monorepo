import { describe, it, expect, vi } from "vitest";
import {
  ListExpensesService,
  CreateExpenseService,
  UpdateExpenseService,
  DeleteExpenseService,
} from "./expense-services";
import {
  mockExpenseRepo,
  testExpense,
  testContext,
} from "./test-helpers";

describe("ListExpensesService", () => {
  it("returns expenses with category", async () => {
    const repo = mockExpenseRepo({
      findMany: vi.fn().mockResolvedValue([testExpense(), testExpense({ id: "exp-2" })]),
    });
    const service = new ListExpensesService(repo);

    const result = await service.execute({}, testContext());

    expect(result).toHaveLength(2);
    expect(result[0].category?.name).toBe("Supplies");
  });

  it("passes filter params through", async () => {
    const repo = mockExpenseRepo();
    const service = new ListExpensesService(repo);

    await service.execute(
      { categoryId: "cat-1", from: "2025-01-01", to: "2025-03-01" },
      testContext(),
    );

    expect(repo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: "cat-1",
        from: new Date("2025-01-01"),
        to: new Date("2025-03-01"),
      }),
    );
  });
});

describe("CreateExpenseService", () => {
  it("creates and returns expense with category", async () => {
    const repo = mockExpenseRepo({
      create: vi.fn().mockResolvedValue(testExpense({ amount: 75000 })),
    });
    const service = new CreateExpenseService(repo);

    const result = await service.execute(
      { amount: 75000, date: "2025-01-15", categoryId: "cat-1" },
      testContext(),
    );

    expect(result.amount).toBe(75000);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: "branch-1" }),
    );
  });
});

describe("UpdateExpenseService", () => {
  it("updates and returns expense", async () => {
    const repo = mockExpenseRepo({
      update: vi.fn().mockResolvedValue(testExpense({ description: "Updated" })),
    });
    const service = new UpdateExpenseService(repo);

    const result = await service.execute("exp-1", { description: "Updated" }, testContext());

    expect(result.description).toBe("Updated");
  });

  it("converts date string to Date object", async () => {
    const repo = mockExpenseRepo();
    const service = new UpdateExpenseService(repo);

    await service.execute("exp-1", { date: "2025-02-01" }, testContext());

    expect(repo.update).toHaveBeenCalledWith(
      "exp-1",
      "branch-1",
      expect.objectContaining({ date: new Date("2025-02-01") }),
    );
  });
});

describe("DeleteExpenseService", () => {
  it("deletes by id and branchId", async () => {
    const repo = mockExpenseRepo();
    const service = new DeleteExpenseService(repo);

    await service.execute("exp-1", testContext());

    expect(repo.delete).toHaveBeenCalledWith("exp-1", "branch-1");
  });
});
