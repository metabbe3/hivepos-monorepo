import type { PricingType, CommissionType } from "../domain/types";

export interface CreateServiceInput {
  name: string;
  description?: string | null;
  pricingType: PricingType;
  basePrice: number;
  isDefaultSpeed?: boolean;
  commissionType?: CommissionType;
  commissionValue?: number;
  isActive?: boolean;
  groupId?: string | null;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string | null;
  pricingType?: PricingType;
  basePrice?: number;
  isDefaultSpeed?: boolean;
  commissionType?: CommissionType;
  commissionValue?: number;
  isActive?: boolean;
  groupId?: string | null;
}

export interface ListServicesInput {
  includeInactive?: boolean;
}

export interface ServiceDTO {
  id: string;
  name: string;
  description: string | null;
  pricingType: PricingType;
  basePrice: number;
  isDefaultSpeed: boolean;
  commissionType: CommissionType;
  commissionValue: number;
  module: string;
  isActive: boolean;
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
  group: { id: string; name: string } | null;
}

export interface CreateGroupInput {
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string | null;
  sortOrder?: number;
}

export interface ReorderGroupsInput {
  groups: Array<{ id: string; sortOrder: number }>;
}

export interface ServiceGroupDTO {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  module: string;
  createdAt: string;
  updatedAt: string;
  serviceCount: number;
}
