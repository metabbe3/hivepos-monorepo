import { describe, it, expect, vi } from "vitest";
import {
  ListRolesService,
  CreateRoleService,
  UpdateRoleService,
  DeleteRoleService,
} from "./role-services";
import type { RoleRepository } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type { RoleRecord } from "../domain/types";
import {
  ValidationError,
  NotFoundError,
  BusinessRuleError,
  ConflictError,
} from "@/modules/shared";

function mockRepo(overrides: Partial<RoleRepository> = {}): RoleRepository {
  return {
    findMany: vi.fn().mockResolvedValue([
      {
        id: "r1",
        name: "Manager",
        description: "Manager role",
        color: "blue",
        permissions: ["orders:read"],
        isSystem: true,
        tenantId: "tenant-1",
        createdAt: new Date("2026-01-01"),
        userCount: 3,
      },
    ]),
    findById: vi.fn().mockResolvedValue({
      id: "r1",
      name: "Manager",
      description: "Manager role",
      color: "blue",
      permissions: ["orders:read"],
      isSystem: true,
      tenantId: "tenant-1",
      createdAt: new Date("2026-01-01"),
      userCount: 3,
    }),
    create: vi.fn().mockResolvedValue({
      id: "r2",
      name: "Custom Role",
      description: null,
      color: "purple",
      permissions: ["orders:read"],
      isSystem: false,
      tenantId: "tenant-1",
      createdAt: new Date("2026-06-01"),
      userCount: 0,
    }),
    update: vi.fn().mockResolvedValue({
      id: "r1",
      name: "Updated",
      description: "Updated desc",
      color: "blue",
      permissions: ["orders:read", "orders:create"],
      isSystem: true,
      tenantId: "tenant-1",
      createdAt: new Date("2026-01-01"),
      userCount: 3,
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    reassignUsersToNull: vi.fn().mockResolvedValue(undefined),
    bumpSessionVersionForRole: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function testCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    userId: "admin-1",
    tenantId: "tenant-1",
    permissions: ["roles:read", "roles:create", "roles:edit", "roles:delete"],
    ...overrides,
  };
}

describe("ListRolesService", () => {
  it("returns all roles with user counts", async () => {
    const service = new ListRolesService(mockRepo());
    const roles = await service.execute(testCtx());
    expect(roles).toHaveLength(1);
    expect(roles[0].userCount).toBe(3);
    expect(roles[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("CreateRoleService", () => {
  it("creates a custom role with valid permissions", async () => {
    const repo = mockRepo();
    const service = new CreateRoleService(repo);
    const role = await service.execute(
      {
        name: "Custom Role",
        description: null,
        color: "purple",
        permissions: ["orders:read"],
      },
      testCtx(),
    );
    expect(role.name).toBe("Custom Role");
    expect(role.isSystem).toBe(false);
  });

  it("throws ValidationError when wildcard is included for custom role", async () => {
    const service = new CreateRoleService(mockRepo());
    await expect(
      service.execute(
        { name: "Bad", description: null, permissions: ["*"] },
        testCtx(),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ConflictError for duplicate name (P2002)", async () => {
    const repo = mockRepo({
      create: vi.fn().mockRejectedValue({ code: "P2002" }),
    });
    const service = new CreateRoleService(repo);
    await expect(
      service.execute(
        { name: "Manager", description: null, permissions: ["orders:read"] },
        testCtx(),
      ),
    ).rejects.toThrow(ConflictError);
  });
});

describe("UpdateRoleService", () => {
  it("throws BusinessRuleError when removing wildcard from Owner role", async () => {
    const repo = mockRepo({
      findById: vi.fn().mockResolvedValue({
        id: "owner",
        name: "Owner",
        description: null,
        color: "indigo",
        permissions: ["*"],
        isSystem: true,
        tenantId: "tenant-1",
        createdAt: new Date("2026-01-01"),
        userCount: 1,
      }),
    });
    const service = new UpdateRoleService(repo);
    await expect(
      service.execute(
        "owner",
        { permissions: ["orders:read"] },
        testCtx(),
      ),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("bumps session version for all users with the role", async () => {
    const repo = mockRepo();
    const service = new UpdateRoleService(repo);
    await service.execute("r1", { permissions: ["orders:read", "orders:create"] }, testCtx());

    expect(repo.bumpSessionVersionForRole).toHaveBeenCalledWith("r1");
  });

  it("throws NotFoundError for non-existent role", async () => {
    const repo = mockRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new UpdateRoleService(repo);
    await expect(
      service.execute("bad", { name: "New" }, testCtx()),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("DeleteRoleService", () => {
  it("throws BusinessRuleError for system roles", async () => {
    const service = new DeleteRoleService(mockRepo());
    await expect(service.execute("r1", testCtx())).rejects.toThrow(BusinessRuleError);
  });

  it("reassigns users to null then deletes", async () => {
    const repo = mockRepo({
      findById: vi.fn().mockResolvedValue({
        id: "r2",
        name: "Custom",
        description: null,
        color: "purple",
        permissions: ["orders:read"],
        isSystem: false,
        tenantId: "tenant-1",
        createdAt: new Date("2026-06-01"),
        userCount: 2,
      }),
    });
    const service = new DeleteRoleService(repo);
    await service.execute("r2", testCtx());

    expect(repo.reassignUsersToNull).toHaveBeenCalledWith("r2");
    expect(repo.delete).toHaveBeenCalledWith("r2");
  });

  it("throws NotFoundError for non-existent role", async () => {
    const repo = mockRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new DeleteRoleService(repo);
    await expect(service.execute("bad", testCtx())).rejects.toThrow(NotFoundError);
  });
});
