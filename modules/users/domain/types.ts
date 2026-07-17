/** Legacy enum synced with the Prisma UserRole. */
export type LegacyRole = "OWNER" | "MANAGER" | "EMPLOYEE";

/** Branch relation on a user record. */
export interface UserBranch {
  id: string;
  name: string;
}

/** Role relation on a user record. */
export interface UserRoleRef {
  id: string;
  name: string;
  color: string;
}

/** User record returned by the repository. */
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: LegacyRole;
  roleId: string | null;
  branchId: string | null;
  createdAt: Date;
  branch: UserBranch | null;
  roleRef: UserRoleRef | null;
}

/** Minimal user shape for ownership checks. */
export interface UserOwnership {
  id: string;
  tenantId: string;
  roleId: string | null;
}
