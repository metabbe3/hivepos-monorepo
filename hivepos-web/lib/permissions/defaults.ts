/**
 * Default system roles seeded for every tenant.
 *
 * These are created on tenant registration and via the seed-rbac backfill
 * script for existing tenants. System roles cannot be deleted; their
 * permissions CAN be edited by the owner (except "Owner" which is always "*").
 */

import type { Permission } from "./definitions";
import { WILDCARD } from "./definitions";

export interface DefaultRole {
  name: string;
  description: string;
  isSystem: boolean;
  color: string;
  /** Permission strings, or ["*"] for the wildcard (Owner only). */
  permissions: Permission[] | [typeof WILDCARD];
}

export const DEFAULT_ROLES: DefaultRole[] = [
  {
    name: "Owner",
    description: "Akses penuh ke semua fitur dan pengaturan",
    isSystem: true,
    color: "indigo",
    permissions: [WILDCARD],
  },
  {
    name: "Manager",
    description:
      "Kelola operasional harian, staff, dan inventory. Tidak akses billing atau roles.",
    isSystem: true,
    color: "blue",
    permissions: [
      "dashboard:read",
      "orders:read",
      "orders:create",
      "orders:edit",
      "orders:delete",
      "orders:discount",
      "customers:read",
      "customers:create",
      "customers:edit",
      "customers:delete",
      "services:read",
      "services:create",
      "services:edit",
      "services:delete",
      "inventory:read",
      "inventory:create",
      "inventory:edit",
      "inventory:delete",
      "expenses:read",
      "expenses:create",
      "expenses:edit",
      "expenses:delete",
      "deposits:read",
      "deposits:create",
      "deposits:edit",
      "reports:read",
      "reports:export",
      "branches:read",
      "branches:edit",
      "users:read",
      "users:create",
      "users:edit",
      "pickupRequests:read",
      "pickupRequests:create",
      "pickupRequests:edit",
      "pickupRequests:delete",
      "attendance:read",
      "attendance:edit",
    ],
  },
  {
    name: "Kasir",
    description:
      "Kasir: transaksi orders dan data pelanggan saja. Tidak bisa edit/hapus data lain.",
    isSystem: true,
    color: "emerald",
    permissions: [
      "dashboard:read",
      "orders:read",
      "orders:create",
      "services:read",
      "customers:read",
      "customers:create",
      "deposits:read",
      "deposits:create",
      "pickupRequests:read",
      "pickupRequests:edit",
      "attendance:read",
    ],
  },
  {
    name: "Staff",
    description:
      "Staff operasional: lihat dashboard, transaksi orders, pelanggan, dan inventory.",
    isSystem: true,
    color: "amber",
    permissions: [
      "dashboard:read",
      "orders:read",
      "orders:create",
      "services:read",
      "customers:read",
      "customers:create",
      "inventory:read",
      "pickupRequests:read",
      "attendance:read",
    ],
  },
];

/** Map legacy UserRole enum values to the default role name they should adopt. */
export function legacyRoleToDefaultName(
  legacy: "OWNER" | "MANAGER" | "EMPLOYEE",
): string {
  switch (legacy) {
    case "OWNER":
      return "Owner";
    case "MANAGER":
      return "Manager";
    case "EMPLOYEE":
    default:
      return "Kasir";
  }
}
