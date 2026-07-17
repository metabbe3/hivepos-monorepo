import type { BranchListItem, BranchDetail } from "./types";

/** Raw create input — operatingHours is handled at the route level. */
export interface CreateBranchRecord {
  name: string;
  address?: string;
  phone?: string;
  invoiceFooter?: string;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsLink?: string | null;
  whatsappLink?: string | null;
  operatingHours?: Record<string, string> | null;
  printerHost?: string | null;
  printerPort?: number;
  printerName?: string | null;
  printerEnabled?: boolean;
  printerPaperSize?: string;
  isActive?: boolean;
  tenantId: string;
  isFreeTier: boolean;
}

export interface UpdateBranchRecord {
  name?: string;
  address?: string;
  phone?: string;
  invoiceFooter?: string;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsLink?: string | null;
  whatsappLink?: string | null;
  operatingHours?: Record<string, string> | null;
  printerHost?: string | null;
  printerPort?: number;
  printerName?: string | null;
  printerEnabled?: boolean;
  printerPaperSize?: string;
  isActive?: boolean;
}

export interface BranchRepository {
  findMany(tenantId: string): Promise<BranchListItem[]>;
  findDetailById(id: string, tenantId: string): Promise<BranchDetail | null>;
  count(tenantId: string): Promise<number>;
  create(data: CreateBranchRecord): Promise<{ id: string }>;
  update(id: string, data: UpdateBranchRecord): Promise<{ id: string }>;
}
