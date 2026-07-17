import { describe, it, expect, vi } from "vitest";
import {
  ListServiceGroupsService,
  CreateServiceGroupService,
  UpdateServiceGroupService,
  DeleteServiceGroupService,
  ReorderServiceGroupsService,
} from "./group-services";
import { NotFoundError, ValidationError } from "@/modules/shared";
import {
  mockGroupRepo,
  testGroup,
  testContext,
} from "./test-helpers";

describe("ListServiceGroupsService", () => {
  it("returns groups for the active module", async () => {
    const repo = mockGroupRepo({
      findMany: vi.fn().mockResolvedValue([testGroup(), testGroup({ id: "grp-2" })]),
    });
    const service = new ListServiceGroupsService(repo);

    const result = await service.execute(testContext());

    expect(result).toHaveLength(2);
    expect(result[0].serviceCount).toBe(3);
  });
});

describe("CreateServiceGroupService", () => {
  it("creates with explicit sortOrder", async () => {
    const repo = mockGroupRepo({
      create: vi.fn().mockResolvedValue(testGroup({ sortOrder: 5 })),
    });
    const service = new CreateServiceGroupService(repo);

    const result = await service.execute({ name: "Special", sortOrder: 5 }, testContext());

    expect(result.sortOrder).toBe(5);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 5 }),
    );
  });

  it("auto-assigns next sortOrder when not provided", async () => {
    const repo = mockGroupRepo({
      getMaxSortOrder: vi.fn().mockResolvedValue(3),
      create: vi.fn().mockResolvedValue(testGroup({ sortOrder: 4 })),
    });
    const service = new CreateServiceGroupService(repo);

    const result = await service.execute({ name: "New Group" }, testContext());

    expect(result.sortOrder).toBe(4);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 4 }),
    );
  });

  it("assigns sortOrder 0 when no groups exist", async () => {
    const repo = mockGroupRepo({
      getMaxSortOrder: vi.fn().mockResolvedValue(-1),
      create: vi.fn().mockResolvedValue(testGroup({ sortOrder: 0 })),
    });
    const service = new CreateServiceGroupService(repo);

    const result = await service.execute({ name: "First" }, testContext());

    expect(result.sortOrder).toBe(0);
  });
});

describe("UpdateServiceGroupService", () => {
  it("updates when group exists", async () => {
    const repo = mockGroupRepo({
      findById: vi.fn().mockResolvedValue(testGroup()),
      update: vi.fn().mockResolvedValue(testGroup({ name: "Renamed" })),
      findMany: vi.fn().mockResolvedValue([testGroup({ name: "Renamed", serviceCount: 2 })]),
    });
    const service = new UpdateServiceGroupService(repo);

    const result = await service.execute("grp-1", { name: "Renamed" }, testContext());

    expect(result.name).toBe("Renamed");
    expect(result.serviceCount).toBe(2);
  });

  it("throws NotFoundError when group does not exist", async () => {
    const repo = mockGroupRepo({
      findById: vi.fn().mockResolvedValue(null),
    });
    const service = new UpdateServiceGroupService(repo);

    await expect(
      service.execute("missing", { name: "X" }, testContext()),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("DeleteServiceGroupService", () => {
  it("ungroups services then deletes", async () => {
    const repo = mockGroupRepo({
      findById: vi.fn().mockResolvedValue(testGroup()),
    });
    const service = new DeleteServiceGroupService(repo);

    await service.execute("grp-1", testContext());

    expect(repo.ungroupServices).toHaveBeenCalledWith("grp-1");
    expect(repo.delete).toHaveBeenCalledWith("grp-1");
  });

  it("throws NotFoundError when group does not exist", async () => {
    const repo = mockGroupRepo({
      findById: vi.fn().mockResolvedValue(null),
    });
    const service = new DeleteServiceGroupService(repo);

    await expect(service.execute("missing", testContext())).rejects.toThrow(NotFoundError);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});

describe("ReorderServiceGroupsService", () => {
  it("reorders when all groups are owned", async () => {
    const repo = mockGroupRepo({
      countByIds: vi.fn().mockResolvedValue(2),
    });
    const service = new ReorderServiceGroupsService(repo);

    await service.execute(
      { groups: [{ id: "grp-1", sortOrder: 0 }, { id: "grp-2", sortOrder: 1 }] },
      testContext(),
    );

    expect(repo.reorder).toHaveBeenCalledWith([
      { id: "grp-1", sortOrder: 0 },
      { id: "grp-2", sortOrder: 1 },
    ]);
  });

  it("throws ValidationError for empty list", async () => {
    const repo = mockGroupRepo();
    const service = new ReorderServiceGroupsService(repo);

    await expect(
      service.execute({ groups: [] }, testContext()),
    ).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError when not all groups are owned", async () => {
    const repo = mockGroupRepo({
      countByIds: vi.fn().mockResolvedValue(1),
    });
    const service = new ReorderServiceGroupsService(repo);

    await expect(
      service.execute(
        { groups: [{ id: "grp-1", sortOrder: 0 }, { id: "foreign", sortOrder: 1 }] },
        testContext(),
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
