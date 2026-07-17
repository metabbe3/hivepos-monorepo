import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ListUsersService,
  CreateUserService,
  UpdateUserService,
  DeleteUserService,
} from "./user-services";
import type { UserRepository } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type { UserRecord } from "../domain/types";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  SubscriptionLimitReachedError,
} from "@/modules/shared";

// ── Mock repository ──

function mockRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findMany: vi.fn().mockResolvedValue([
      {
        id: "u1",
        email: "alice@test.com",
        name: "Alice",
        phone: null,
        role: "MANAGER",
        roleId: "role-1",
        branchId: "b1",
        createdAt: new Date("2026-01-01"),
        branch: { id: "b1", name: "Main" },
        roleRef: { id: "role-1", name: "Manager", color: "blue" },
      },
    ]),
    findOwnership: vi.fn().mockResolvedValue({
      id: "u1",
      tenantId: "tenant-1",
      roleId: "role-1",
    }),
    findByEmail: vi.fn().mockResolvedValue(null),
    findRoleById: vi.fn().mockResolvedValue({ id: "role-1", name: "Manager" }),
    findBranchById: vi.fn().mockResolvedValue({ id: "b1" }),
    create: vi.fn().mockResolvedValue({
      id: "u2",
      email: "new@test.com",
      name: "New User",
      phone: null,
      role: "MANAGER",
      roleId: "role-1",
      branchId: "b1",
      createdAt: new Date("2026-06-01"),
      branch: { id: "b1", name: "Main" },
      roleRef: { id: "role-1", name: "Manager", color: "blue" },
    }),
    update: vi.fn().mockResolvedValue({
      id: "u1",
      email: "alice@test.com",
      name: "Alice Updated",
      phone: "123",
      role: "MANAGER",
      roleId: "role-1",
      branchId: "b1",
      createdAt: new Date("2026-01-01"),
      branch: { id: "b1", name: "Main" },
      roleRef: { id: "role-1", name: "Manager", color: "blue" },
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function testCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    userId: "admin-1",
    tenantId: "tenant-1",
    permissions: ["users:read", "users:create", "users:edit", "users:delete"],
    ...overrides,
  };
}

// Mock the billing limit check
vi.mock("@/lib/billing", () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, max: 2 }),
}));

describe("ListUsersService", () => {
  it("returns all users for the tenant", async () => {
    const service = new ListUsersService(mockRepo());
    const users = await service.execute(testCtx());
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("alice@test.com");
    expect(users[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("CreateUserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a user when all checks pass", async () => {
    const repo = mockRepo();
    const service = new CreateUserService(repo);
    const user = await service.execute(
      {
        email: "new@test.com",
        name: "New User",
        phone: null,
        roleId: "role-1",
        branchId: "b1",
        password: "secret123",
      },
      testCtx(),
    );

    expect(user.email).toBe("new@test.com");
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it("throws SubscriptionLimitReachedError when limit is hit", async () => {
    const { checkLimit } = await import("@/lib/billing");
    (checkLimit as any).mockResolvedValueOnce({
      allowed: false,
      current: 2,
      max: 2,
      reason: "Batas staff gratis tercapai",
    });

    const service = new CreateUserService(mockRepo());

    await expect(
      service.execute(
        {
          email: "new@test.com",
          name: "New User",
          phone: null,
          roleId: "role-1",
          branchId: "b1",
          password: "secret123",
        },
        testCtx(),
      ),
    ).rejects.toThrow(SubscriptionLimitReachedError);
  });

  it("throws ValidationError for invalid branch", async () => {
    const repo = mockRepo({ findBranchById: vi.fn().mockResolvedValue(null) });
    const service = new CreateUserService(repo);

    await expect(
      service.execute(
        {
          email: "new@test.com",
          name: "New",
          phone: null,
          roleId: "role-1",
          branchId: "bad",
          password: "secret123",
        },
        testCtx(),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for invalid role", async () => {
    const repo = mockRepo({ findRoleById: vi.fn().mockResolvedValue(null) });
    const service = new CreateUserService(repo);

    await expect(
      service.execute(
        {
          email: "new@test.com",
          name: "New",
          phone: null,
          roleId: "bad",
          branchId: "b1",
          password: "secret123",
        },
        testCtx(),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ConflictError for duplicate email", async () => {
    const repo = mockRepo({ findByEmail: vi.fn().mockResolvedValue({ id: "existing" }) });
    const service = new CreateUserService(repo);

    await expect(
      service.execute(
        {
          email: "existing@test.com",
          name: "New",
          phone: null,
          roleId: "role-1",
          branchId: "b1",
          password: "secret123",
        },
        testCtx(),
      ),
    ).rejects.toThrow(ConflictError);
  });
});

describe("UpdateUserService", () => {
  it("throws NotFoundError for non-existent user", async () => {
    const repo = mockRepo({ findOwnership: vi.fn().mockResolvedValue(null) });
    const service = new UpdateUserService(repo);

    await expect(
      service.execute("bad", { name: "Updated" }, testCtx()),
    ).rejects.toThrow(NotFoundError);
  });

  it("bumps sessionVersion when role changes", async () => {
    const repo = mockRepo({
      findOwnership: vi.fn().mockResolvedValue({
        id: "u1",
        tenantId: "tenant-1",
        roleId: "old-role",
      }),
      update: vi.fn().mockImplementation((_id, data) => {
        expect(data.sessionVersion).toEqual({ increment: 1 });
        return Promise.resolve({
          id: "u1",
          email: "a@b.com",
          name: "Updated",
          phone: null,
          role: "MANAGER",
          roleId: "new-role",
          branchId: "b1",
          createdAt: new Date("2026-01-01"),
          branch: null,
          roleRef: null,
        });
      }),
    });
    const service = new UpdateUserService(repo);
    await service.execute("u1", { roleId: "new-role" }, testCtx());

    expect(repo.update).toHaveBeenCalledOnce();
  });

  it("does NOT bump sessionVersion when role stays the same", async () => {
    const repo = mockRepo({
      findOwnership: vi.fn().mockResolvedValue({
        id: "u1",
        tenantId: "tenant-1",
        roleId: "same-role",
      }),
      update: vi.fn().mockImplementation((_id, data) => {
        expect(data.sessionVersion).toBeUndefined();
        return Promise.resolve({
          id: "u1",
          email: "a@b.com",
          name: "Updated",
          phone: null,
          role: "MANAGER",
          roleId: "same-role",
          branchId: "b1",
          createdAt: new Date("2026-01-01"),
          branch: null,
          roleRef: null,
        });
      }),
    });
    const service = new UpdateUserService(repo);
    await service.execute("u1", { roleId: "same-role" }, testCtx());
  });
});

describe("DeleteUserService", () => {
  it("throws ValidationError when deleting own account", async () => {
    const service = new DeleteUserService(mockRepo());

    await expect(
      service.execute("admin-1", testCtx({ userId: "admin-1" })),
    ).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError for non-existent user", async () => {
    const repo = mockRepo({ findOwnership: vi.fn().mockResolvedValue(null) });
    const service = new DeleteUserService(repo);

    await expect(
      service.execute("unknown", testCtx()),
    ).rejects.toThrow(NotFoundError);
  });

  it("deletes successfully for a valid user", async () => {
    const repo = mockRepo();
    const service = new DeleteUserService(repo);

    await service.execute("u1", testCtx());
    expect(repo.delete).toHaveBeenCalledWith("u1");
  });
});
