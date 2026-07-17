import { prisma } from "@/lib/prisma";
import type {
  UserRepository,
  CreateUserRecord,
  UpdateUserRecord,
} from "../domain/repository.port";
import type { UserRecord, UserOwnership, LegacyRole } from "../domain/types";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  roleId: true,
  branchId: true,
  createdAt: true,
  branch: { select: { id: true, name: true } },
  roleRef: { select: { id: true, name: true, color: true } },
} as const;

export class PrismaUserRepository implements UserRepository {
  async findMany(tenantId: string): Promise<UserRecord[]> {
    return prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: USER_SELECT,
    }) as Promise<UserRecord[]>;
  }

  async findOwnership(id: string): Promise<UserOwnership | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, tenantId: true, roleId: true },
    });
    return user;
  }

  async findByEmail(email: string): Promise<{ id: string } | null> {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
  }

  async findRoleById(
    roleId: string,
    tenantId: string,
  ): Promise<{ id: string; name: string } | null> {
    return prisma.role.findFirst({
      where: { id: roleId, tenantId },
      select: { id: true, name: true },
    });
  }

  async findBranchById(
    branchId: string,
    tenantId: string,
  ): Promise<{ id: string } | null> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, tenantId: true },
    });
    if (!branch || branch.tenantId !== tenantId) return null;
    return { id: branch.id };
  }

  async create(data: CreateUserRecord): Promise<UserRecord> {
    return prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        phone: data.phone,
        role: data.role as LegacyRole,
        roleId: data.roleId,
        branchId: data.branchId,
        tenantId: data.tenantId,
        passwordHash: data.passwordHash,
      },
      select: USER_SELECT,
    }) as Promise<UserRecord>;
  }

  async update(id: string, data: UpdateUserRecord): Promise<UserRecord> {
    return prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    }) as Promise<UserRecord>;
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }
}
