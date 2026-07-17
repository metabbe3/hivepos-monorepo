import { describe, it, expect, vi } from "vitest";
import {
  ListServicesService,
  CreateServiceService,
  UpdateServiceService,
  DeleteServiceService,
} from "./service-services";
import { NotFoundError } from "@/modules/shared";
import {
  mockServiceRepo,
  testService,
  testContext,
} from "./test-helpers";

describe("ListServicesService", () => {
  it("returns services for the active module", async () => {
    const repo = mockServiceRepo({
      findMany: vi.fn().mockResolvedValue([testService(), testService({ id: "svc-2" })]),
    });
    const service = new ListServicesService(repo);

    const result = await service.execute({}, testContext());

    expect(result).toHaveLength(2);
    expect(result[0].basePrice).toBe(7000);
    expect(repo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: "branch-1", module: "LAUNDRY" }),
    );
  });

  it("passes includeInactive flag", async () => {
    const repo = mockServiceRepo();
    const service = new ListServicesService(repo);

    await service.execute({ includeInactive: true }, testContext());

    expect(repo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ includeInactive: true }),
    );
  });
});

describe("CreateServiceService", () => {
  it("creates a new service when no inactive match exists", async () => {
    const repo = mockServiceRepo({
      findInactiveByName: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(testService({ name: "New Service" })),
    });
    const service = new CreateServiceService(repo);

    const result = await service.execute(
      { name: "New Service", pricingType: "PER_KG", basePrice: 5000 },
      testContext(),
    );

    expect(result.name).toBe("New Service");
    expect(repo.create).toHaveBeenCalled();
    expect(repo.reactivate).not.toHaveBeenCalled();
  });

  it("reactivates an existing soft-deleted service with the same name", async () => {
    const repo = mockServiceRepo({
      findInactiveByName: vi.fn().mockResolvedValue(testService({ id: "old-1", isActive: false })),
      reactivate: vi.fn().mockResolvedValue(testService({ id: "old-1", isActive: true })),
    });
    const service = new CreateServiceService(repo);

    const result = await service.execute(
      { name: "Cuci Kering", pricingType: "PER_KG", basePrice: 7000 },
      testContext(),
    );

    expect(result.id).toBe("old-1");
    expect(repo.reactivate).toHaveBeenCalledWith(
      "old-1",
      expect.objectContaining({ name: "Cuci Kering" }),
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("passes module and branchId from context", async () => {
    const repo = mockServiceRepo();
    const service = new CreateServiceService(repo);

    await service.execute(
      { name: "Test", pricingType: "PER_ITEM", basePrice: 10000 },
      testContext({ branchId: "branch-x", activeModule: "FNB" }),
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: "branch-x", module: "FNB" }),
    );
  });
});

describe("UpdateServiceService", () => {
  it("updates and returns the service", async () => {
    const repo = mockServiceRepo({
      update: vi.fn().mockResolvedValue(testService({ name: "Updated" })),
    });
    const service = new UpdateServiceService(repo);

    const result = await service.execute("svc-1", { name: "Updated" }, testContext());

    expect(result.name).toBe("Updated");
    expect(repo.update).toHaveBeenCalledWith("svc-1", "branch-1", { name: "Updated" });
  });
});

describe("DeleteServiceService", () => {
  it("soft-deletes when service exists in branch", async () => {
    const repo = mockServiceRepo({
      findMany: vi.fn().mockResolvedValue([testService({ id: "svc-1" })]),
    });
    const service = new DeleteServiceService(repo);

    await service.execute("svc-1", testContext());

    expect(repo.softDelete).toHaveBeenCalledWith("svc-1", "branch-1");
  });

  it("throws NotFoundError when service does not exist", async () => {
    const repo = mockServiceRepo({
      findMany: vi.fn().mockResolvedValue([]),
    });
    const service = new DeleteServiceService(repo);

    await expect(service.execute("missing", testContext())).rejects.toThrow(NotFoundError);
    expect(repo.softDelete).not.toHaveBeenCalled();
  });
});
