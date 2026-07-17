/**
 * RBAC Permission Definitions
 *
 * Permissions are strings in the form `{resource}:{action}`.
 * A single wildcard `"*"` grants all permissions (Owner only).
 */

export const RESOURCES = [
  "dashboard",
  "orders",
  "customers",
  "services", // services + service groups
  "inventory", // stock items + movements
  "expenses", // expenses + expense categories
  "deposits", // customer wallet / deposit transactions
  "reports", // all reporting APIs
  "branches", // outlet management
  "users", // staff management
  "roles", // role management (this feature)
  "billing", // SaaS subscription
  "pickupRequests", // customer pickup request workflow
  "attendance", // staff clock-in/out + attendance reports
] as const;

export const ACTIONS = [
  "read",
  "create",
  "edit",
  "delete",
  "export",
  "discount",
] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = (typeof ACTIONS)[number];
export type Permission = `${Resource}:${Action}`;

/** Wildcard granting all permissions (Owner role only). */
export const WILDCARD = "*";

/** Which actions apply to which resources. */
export const RESOURCE_ACTIONS: Record<Resource, Action[]> = {
  dashboard: ["read"],
  orders: ["read", "create", "edit", "delete", "discount"],
  customers: ["read", "create", "edit", "delete"],
  services: ["read", "create", "edit", "delete"],
  inventory: ["read", "create", "edit", "delete"],
  expenses: ["read", "create", "edit", "delete"],
  deposits: ["read", "create", "edit"],
  reports: ["read", "export"],
  branches: ["read", "create", "edit", "delete"],
  users: ["read", "create", "edit", "delete"],
  roles: ["read", "create", "edit", "delete"],
  billing: ["read"],
  pickupRequests: ["read", "create", "edit", "delete"],
  attendance: ["read", "edit"],
};

/** Human-readable labels for each resource (for the permission matrix UI). */
export const RESOURCE_LABELS: Record<Resource, string> = {
  dashboard: "Dashboard",
  orders: "Orders / Transaksi",
  customers: "Pelanggan",
  services: "Layanan & Harga",
  inventory: "Inventory",
  expenses: "Pengeluaran",
  deposits: "Deposit / Wallet",
  reports: "Laporan",
  branches: "Outlet",
  users: "Staff",
  roles: "Roles & Permissions",
  billing: "Billing",
  pickupRequests: "Pickup Requests",
  attendance: "Absensi",
};

/** Human-readable labels for each action. */
export const ACTION_LABELS: Record<Action, string> = {
  read: "Lihat",
  create: "Buat",
  edit: "Edit",
  delete: "Hapus",
  export: "Export",
  discount: "Diskon",
};

/** All valid permission strings (for validation / seeding). */
export const ALL_PERMISSIONS: Permission[] = RESOURCES.flatMap((r) =>
  RESOURCE_ACTIONS[r].map((a) => `${r}:${a}` as Permission),
);

/**
 * Check whether a permission string list grants a resource:action.
 * Honors the `"*"` wildcard.
 */
export function hasPermission(
  permissions: string[] | null | undefined,
  resource: Resource,
  action: Action,
): boolean {
  if (!permissions) return false;
  if (permissions.includes(WILDCARD)) return true;
  return permissions.includes(`${resource}:${action}`);
}

/** True if the holder has ANY action on the given resource. */
export function hasAnyAction(
  permissions: string[] | null | undefined,
  resource: Resource,
): boolean {
  if (!permissions) return false;
  if (permissions.includes(WILDCARD)) return true;
  return RESOURCE_ACTIONS[resource].some((a) =>
    permissions.includes(`${resource}:${a}`),
  );
}
