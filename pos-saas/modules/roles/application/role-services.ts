import type { RoleRepository } from "../domain/repository.port";
import { validatePermissions, isOwnerRole } from "../domain/permission-validation";
import type { RequestContext } from "./context";
import type { CreateRoleInput, UpdateRoleInput, RoleDTO } from "./dto";
import {
  ValidationError,
  NotFoundError,
  BusinessRuleError,
  toIsoRequired,
} from "@/modules/shared";
import { mapPrismaUniqueError } from "@/modules/shared/errors/prisma-errors";
import { WILDCARD } from "@/lib/permissions/definitions";

function toDTO(r: {
  id: string;
  name: string;
  description: string | null;
  color: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  userCount: number;
}): RoleDTO {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    permissions: r.permissions,
    isSystem: r.isSystem,
    createdAt: toIsoRequired(r.createdAt),
    userCount: r.userCount,
  };
}

export class ListRolesService {
  constructor(private repo: RoleRepository) {}

  async execute(ctx: RequestContext): Promise<RoleDTO[]> {
    const roles = await this.repo.findMany(ctx.tenantId);
    return roles.map(toDTO);
  }
}

export class GetRoleService {
  constructor(private repo: RoleRepository) {}

  async execute(id: string, ctx: RequestContext): Promise<RoleDTO> {
    const role = await this.repo.findById(id, ctx.tenantId);
    if (!role) throw new NotFoundError("Role", id);
    return toDTO(role);
  }
}

export class CreateRoleService {
  constructor(private repo: RoleRepository) {}

  async execute(input: CreateRoleInput, ctx: RequestContext): Promise<RoleDTO> {
    // Custom roles cannot hold wildcard
    const validation = validatePermissions(input.permissions, false);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    try {
      const role = await this.repo.create({
        name: input.name,
        description: input.description,
        color: input.color ?? "purple",
        permissions: input.permissions,
        tenantId: ctx.tenantId,
      });
      return toDTO(role);
    } catch (error: unknown) {
      mapPrismaUniqueError(error, "A role with this name already exists");
    }
  }
}

export class UpdateRoleService {
  constructor(private repo: RoleRepository) {}

  async execute(
    id: string,
    input: UpdateRoleInput,
    ctx: RequestContext,
  ): Promise<RoleDTO> {
    const role = await this.repo.findById(id, ctx.tenantId);
    if (!role) throw new NotFoundError("Role", id);

    const ownerRole = isOwnerRole(role.permissions);

    // Owner role must retain wildcard
    if (ownerRole && input.permissions && !input.permissions.includes(WILDCARD)) {
      throw new BusinessRuleError(
        "Owner role must retain wildcard permissions",
      );
    }

    // Validate permission strings
    if (input.permissions) {
      const validation = validatePermissions(input.permissions, ownerRole);
      if (!validation.valid) {
        throw new ValidationError(validation.error!);
      }
    }

    try {
      const updated = await this.repo.update(id, {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.color ? { color: input.color } : {}),
        ...(input.permissions ? { permissions: input.permissions } : {}),
      });

      // Bump sessionVersion for all users with this role
      await this.repo.bumpSessionVersionForRole(id);

      return toDTO(updated);
    } catch (error: unknown) {
      mapPrismaUniqueError(error, "A role with this name already exists");
    }
  }
}

export class DeleteRoleService {
  constructor(private repo: RoleRepository) {}

  async execute(id: string, ctx: RequestContext): Promise<void> {
    const role = await this.repo.findById(id, ctx.tenantId);
    if (!role) throw new NotFoundError("Role", id);

    if (role.isSystem) {
      throw new BusinessRuleError("System roles cannot be deleted");
    }

    // Reassign users before deleting
    await this.repo.reassignUsersToNull(id);
    await this.repo.delete(id);
  }
}
