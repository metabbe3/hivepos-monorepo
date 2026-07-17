import { prisma } from "@/lib/prisma";
import type {
  RoleRepository,
  CreateRoleRecord,
  UpdateRoleRecord,
} from "../domain/repository.port";
import type { RoleRecord } from "../domain/types";

function mapRole(r: {
  id: string;
  name: string;
  description: string | null;
  color: string;
  permissions: string[];
  isSystem: boolean;
  tenantId: string;
  createdAt: Date;
  _count?: { users: number };
}): RoleRecord {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    permissions: r.permissions,
    isSystem: r.isSystem,
    tenantId: r.tenantId,
    createdAt: r.createdAt,
    userCount: r._count?.users ?? 0,
  };
}

export class PrismaRoleRepository implements RoleRepository {
  async findMany(tenantId: string): Promise<RoleRecord[]> {
    const roles = await prisma.role.findMany({
      where: { tenantId },
      include: { _count: { select: { users: true } } },
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
    });
    return roles.map(mapRole);
  }

  async findById(id: string, tenantId: string): Promise<RoleRecord | null> {
    const role = await prisma.role.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { users: true } } },
    });
    return role ? mapRole(role) : null;
  }

  async create(data: CreateRoleRecord): Promise<RoleRecord> {
    const role = await prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        permissions: data.permissions,
        isSystem: false,
        tenantId: data.tenantId,
      },
      include: { _count: { select: { users: true } } },
    });
    return mapRole(role);
  }

  async update(id: string, data: UpdateRoleRecord): Promise<RoleRecord> {
    const role = await prisma.role.update({
      where: { id },
      data,
      include: { _count: { select: { users: true } } },
    });
    return mapRole(role);
  }

  async delete(id: string): Promise<void> {
    await prisma.role.delete({ where: { id } });
  }

  async reassignUsersToNull(roleId: string): Promise<void> {
    await prisma.user.updateMany({
      where: { roleId },
      data: { roleId: null },
    });
  }

  async bumpSessionVersionForRole(roleId: string): Promise<void> {
    await prisma.user.updateMany({
      where: { roleId },
      data: { sessionVersion: { increment: 1 } },
    });
  }
}
