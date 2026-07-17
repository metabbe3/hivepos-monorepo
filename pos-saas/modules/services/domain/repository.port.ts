import type { BusinessModule, PricingType, CommissionType } from "./types";

// ── Persistence shapes ─────────────────────────────────────────────────

export interface ServiceRecord {
  id: string;
  name: string;
  description: string | null;
  pricingType: PricingType;
  basePrice: number;
  commissionType: CommissionType;
  commissionValue: number;
  module: BusinessModule;
  isActive: boolean;
  isDefaultSpeed: boolean;
  branchId: string;
  groupId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceWithGroup extends ServiceRecord {
  group: { id: string; name: string } | null;
}

export interface ServiceGroupRecord {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  module: BusinessModule;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceGroupWithCount extends ServiceGroupRecord {
  serviceCount: number;
}

// ── Query/input shapes ────────────────────────────────────────────────

export interface ListServicesQuery {
  branchId: string;
  module: BusinessModule;
  includeInactive?: boolean;
}

export interface ListGroupsQuery {
  branchId: string;
  module: BusinessModule;
}

export interface CreateServiceData {
  name: string;
  description?: string | null;
  pricingType: PricingType;
  basePrice: number;
  commissionType?: CommissionType;
  commissionValue?: number;
  isActive?: boolean;
  groupId?: string | null;
  module: BusinessModule;
  branchId: string;
  isDefaultSpeed?: boolean;
}

export interface UpdateServiceData {
  name?: string;
  description?: string | null;
  pricingType?: PricingType;
  basePrice?: number;
  commissionType?: CommissionType;
  commissionValue?: number;
  isActive?: boolean;
  groupId?: string | null;
  isDefaultSpeed?: boolean;
}

export interface CreateGroupData {
  name: string;
  description?: string | null;
  sortOrder?: number;
  module: BusinessModule;
  branchId: string;
}

export interface UpdateGroupData {
  name?: string;
  description?: string | null;
  sortOrder?: number;
}

export interface ReorderEntry {
  id: string;
  sortOrder: number;
}

// ── Repository ports ───────────────────────────────────────────────────

export interface ServiceRepository {
  findMany(query: ListServicesQuery): Promise<ServiceWithGroup[]>;
  findInactiveByName(
    name: string,
    branchId: string,
  ): Promise<ServiceRecord | null>;
  create(data: CreateServiceData): Promise<ServiceWithGroup>;
  reactivate(
    id: string,
    data: CreateServiceData,
  ): Promise<ServiceWithGroup>;
  update(
    id: string,
    branchId: string,
    data: UpdateServiceData,
  ): Promise<ServiceWithGroup>;
  softDelete(id: string, branchId: string): Promise<void>;
}

export interface ServiceGroupRepository {
  findMany(query: ListGroupsQuery): Promise<ServiceGroupWithCount[]>;
  findById(id: string, branchId: string): Promise<ServiceGroupRecord | null>;
  getMaxSortOrder(branchId: string, module: BusinessModule): Promise<number>;
  create(data: CreateGroupData): Promise<ServiceGroupRecord>;
  update(
    id: string,
    data: UpdateGroupData,
  ): Promise<ServiceGroupRecord>;
  delete(id: string): Promise<void>;
  ungroupServices(groupId: string): Promise<void>;
  reorder(entries: ReorderEntry[]): Promise<void>;
  countByIds(ids: string[], branchId: string): Promise<number>;
}
