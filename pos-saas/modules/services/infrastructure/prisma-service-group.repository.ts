import { prisma } from "@/lib/prisma";
import type {
  ServiceGroupRepository,
  ServiceGroupWithCount,
  ServiceGroupRecord,
  ListGroupsQuery,
  CreateGroupData,
  UpdateGroupData,
  ReorderEntry,
} from "../domain/repository.port";
import type { BusinessModule } from "../domain/types";

function mapGroupRecord(g: any): ServiceGroupRecord {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    sortOrder: g.sortOrder,
    module: g.module as BusinessModule,
    branchId: g.branchId,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

function mapGroupWithCount(g: any): ServiceGroupWithCount {
  return {
    ...mapGroupRecord(g),
    serviceCount: g._count?.services ?? 0,
  };
}

export class PrismaServiceGroupRepository implements ServiceGroupRepository {
  async findMany(query: ListGroupsQuery): Promise<ServiceGroupWithCount[]> {
    const rows = await prisma.serviceGroup.findMany({
      where: { branchId: query.branchId, module: query.module },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { services: { where: { isActive: true } } } },
      },
    });
    return rows.map(mapGroupWithCount);
  }

  async findById(id: string, branchId: string): Promise<ServiceGroupRecord | null> {
    const g = await prisma.serviceGroup.findFirst({
      where: { id, branchId },
    });
    return g ? mapGroupRecord(g) : null;
  }

  async getMaxSortOrder(branchId: string, module: BusinessModule): Promise<number> {
    const latest = await prisma.serviceGroup.findFirst({
      where: { branchId, module },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return latest?.sortOrder ?? -1;
  }

  async create(data: CreateGroupData): Promise<ServiceGroupRecord> {
    const g = await prisma.serviceGroup.create({
      data: {
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
        module: data.module,
        branchId: data.branchId,
      },
    });
    return mapGroupRecord(g);
  }

  async update(id: string, data: UpdateGroupData): Promise<ServiceGroupRecord> {
    const g = await prisma.serviceGroup.update({
      where: { id },
      data,
    });
    return mapGroupRecord(g);
  }

  async delete(id: string): Promise<void> {
    await prisma.serviceGroup.delete({ where: { id } });
  }

  async ungroupServices(groupId: string): Promise<void> {
    await prisma.service.updateMany({
      where: { groupId },
      data: { groupId: null },
    });
  }

  async reorder(entries: ReorderEntry[]): Promise<void> {
    await prisma.$transaction(
      entries.map((g) =>
        prisma.serviceGroup.update({
          where: { id: g.id },
          data: { sortOrder: g.sortOrder },
        }),
      ),
    );
  }

  async countByIds(ids: string[], branchId: string): Promise<number> {
    return prisma.serviceGroup.count({
      where: { id: { in: ids }, branchId },
    });
  }
}
