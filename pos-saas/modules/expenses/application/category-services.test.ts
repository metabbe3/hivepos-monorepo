import { describe, it, expect, vi } from "vitest";
import {
  ListExpenseCategoriesService,
  CreateExpenseCategoryService,
  UpdateExpenseCategoryService,
  DeleteExpenseCategoryService,
} from "./category-services";
import { BusinessRuleError } from "@/modules/shared";
import {
  mockCategoryRepo,
  testCategory,
  testContext,
} from "./test-helpers";

describe("ListExpenseCategoriesService", () => {
  it("returns categories for branch", async () => {
    const repo = mockCategoryRepo({
      findMany: vi.fn().mockResolvedValue([testCategory(), testCategory({ id: "cat-2" })]),
    });
    const service = new ListExpenseCategoriesService(repo);

    const result = await service.execute(testContext());

    expect(result).toHaveLength(2);
  });
});

describe("CreateExpenseCategoryService", () => {
  it("creates and returns category", async () => {
    const repo = mockCategoryRepo({
      create: vi.fn().mockResolvedValue(testCategory({ name: "Utilities" })),
    });
    const service = new CreateExpenseCategoryService(repo);

    const result = await service.execute({ name: "Utilities" }, testContext());

    expect(result.name).toBe("Utilities");
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Utilities", branchId: "branch-1" }),
    );
  });
});

describe("UpdateExpenseCategoryService", () => {
  it("updates and returns category", async () => {
    const repo = mockCategoryRepo({
      update: vi.fn().mockResolvedValue(testCategory({ name: "Renamed" })),
    });
    const service = new UpdateExpenseCategoryService(repo);

    const result = await service.execute("cat-1", { name: "Renamed" }, testContext());

    expect(result.name).toBe("Renamed");
  });
});

describe("DeleteExpenseCategoryService", () => {
  it("deletes when no expenses reference it", async () => {
    const repo = mockCategoryRepo({
      countExpenses: vi.fn().mockResolvedValue(0),
    });
    const service = new DeleteExpenseCategoryService(repo);

    await service.execute("cat-1", testContext());

    expect(repo.delete).toHaveBeenCalledWith("cat-1", "branch-1");
  });

  it("throws BusinessRuleError when expenses reference it", async () => {
    const repo = mockCategoryRepo({
      countExpenses: vi.fn().mockResolvedValue(5),
    });
    const service = new DeleteExpenseCategoryService(repo);

    await expect(service.execute("cat-1", testContext())).rejects.toThrow(BusinessRuleError);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
