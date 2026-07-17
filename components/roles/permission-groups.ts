import {
  RESOURCE_ACTIONS,
  type Resource,
} from "@/lib/permissions/definitions";

export type GroupId = "operasional" | "keuangan" | "manajemen";

export interface PermissionGroup {
  id: GroupId;
  label: string;
  description: string;
  iconKey: "operasional" | "keuangan" | "manajemen";
  resources: Resource[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "operasional",
    label: "Operasional",
    description: "Transaksi harian dan data pelanggan",
    iconKey: "operasional",
    resources: ["orders", "customers", "services", "inventory"],
  },
  {
    id: "keuangan",
    label: "Keuangan",
    description: "Arus kas, deposit, laporan, dan tagihan",
    iconKey: "keuangan",
    resources: ["expenses", "deposits", "reports", "billing"],
  },
  {
    id: "manajemen",
    label: "Manajemen",
    description: "Outlet, staff, roles, dan dashboard",
    iconKey: "manajemen",
    resources: ["dashboard", "branches", "users", "roles"],
  },
];

/** Total individually-grantable permissions across all resources. */
export const TOTAL_PERMISSIONS = Object.values(RESOURCE_ACTIONS).reduce(
  (sum, actions) => sum + actions.length,
  0,
);

/** All `resource:action` strings for a given group. */
export function groupPermissionKeys(group: PermissionGroup): string[] {
  return group.resources.flatMap((r) =>
    RESOURCE_ACTIONS[r].map((a) => `${r}:${a}`),
  );
}
