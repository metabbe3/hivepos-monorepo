import type { UserRepository } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type { CreateUserInput, UpdateUserInput, UserDTO } from "./dto";
import type { LegacyRole } from "../domain/types";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  SubscriptionLimitReachedError,
  toIsoRequired,
} from "@/modules/shared";
import { hashPassword } from "@/modules/shared/application/password";
import { SESSION_VERSION_INCREMENT } from "@/modules/shared/application/session-version";
import { checkLimit } from "@/lib/billing";

function deriveLegacyRole(roleName: string): LegacyRole {
  if (roleName === "Owner") return "OWNER";
  if (roleName === "Manager") return "MANAGER";
  return "EMPLOYEE";
}

function toDTO(u: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: LegacyRole;
  roleId: string | null;
  branchId: string | null;
  createdAt: Date;
  branch: { id: string; name: string } | null;
  roleRef: { id: string; name: string; color: string } | null;
}): UserDTO {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    roleId: u.roleId,
    branchId: u.branchId,
    createdAt: toIsoRequired(u.createdAt),
    branch: u.branch,
    roleRef: u.roleRef,
  };
}

export class ListUsersService {
  constructor(private repo: UserRepository) {}

  async execute(ctx: RequestContext): Promise<UserDTO[]> {
    const users = await this.repo.findMany(ctx.tenantId);
    return users.map(toDTO);
  }
}

export class CreateUserService {
  constructor(private repo: UserRepository) {}

  async execute(input: CreateUserInput, ctx: RequestContext): Promise<UserDTO> {
    // ── Free-tier user limit check ──
    const limitCheck = await checkLimit(ctx.tenantId, "users");
    if (!limitCheck.allowed) {
      throw new SubscriptionLimitReachedError(
        limitCheck.reason ?? "User limit reached",
        [
          { field: "users", message: `${limitCheck.current}/${limitCheck.max}` },
        ],
      );
    }

    // ── Verify branch belongs to tenant ──
    const branch = await this.repo.findBranchById(input.branchId, ctx.tenantId);
    if (!branch) {
      throw new ValidationError("Invalid branch");
    }

    // ── Verify role belongs to tenant ──
    const role = await this.repo.findRoleById(input.roleId, ctx.tenantId);
    if (!role) {
      throw new ValidationError("Invalid role");
    }

    // ── Duplicate email check ──
    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      throw new ConflictError("Email already exists");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.repo.create({
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: deriveLegacyRole(role.name),
      roleId: input.roleId,
      branchId: input.branchId,
      tenantId: ctx.tenantId,
      passwordHash,
    });

    return toDTO(user);
  }
}

export class UpdateUserService {
  constructor(private repo: UserRepository) {}

  async execute(
    id: string,
    input: UpdateUserInput,
    ctx: RequestContext,
  ): Promise<UserDTO> {
    const existing = await this.repo.findOwnership(id);
    if (!existing || existing.tenantId !== ctx.tenantId) {
      throw new NotFoundError("User", id);
    }

    const data: Record<string, unknown> = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.branchId !== undefined) data.branchId = input.branchId;
    if (input.roleId !== undefined) data.roleId = input.roleId;

    if (input.password) {
      data.passwordHash = await hashPassword(input.password);
    }

    // Bump sessionVersion when role changes → JWT refresh
    if (input.roleId && input.roleId !== existing.roleId) {
      data.sessionVersion = SESSION_VERSION_INCREMENT;
    }

    const user = await this.repo.update(id, data);
    return toDTO(user);
  }
}

export class DeleteUserService {
  constructor(private repo: UserRepository) {}

  async execute(id: string, ctx: RequestContext): Promise<void> {
    if (id === ctx.userId) {
      throw new ValidationError("Cannot delete your own account");
    }

    const existing = await this.repo.findOwnership(id);
    if (!existing || existing.tenantId !== ctx.tenantId) {
      throw new NotFoundError("User", id);
    }

    await this.repo.delete(id);
  }
}
