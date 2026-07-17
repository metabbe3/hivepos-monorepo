import type { UserRecord, UserOwnership, LegacyRole } from "./types";

/** Input shape for creating a user (password already hashed). */
export interface CreateUserRecord {
  email: string;
  name: string;
  phone: string | null;
  role: LegacyRole;
  roleId: string;
  branchId: string;
  tenantId: string;
  passwordHash: string;
}

/** Input shape for updating a user. */
export interface UpdateUserRecord {
  name?: string;
  phone?: string | null;
  roleId?: string;
  branchId?: string;
  passwordHash?: string;
  sessionVersion?: { increment: number };
}

export interface UserRepository {
  findMany(tenantId: string): Promise<UserRecord[]>;
  findOwnership(id: string): Promise<UserOwnership | null>;
  findByEmail(email: string): Promise<{ id: string } | null>;
  findRoleById(roleId: string, tenantId: string): Promise<{ id: string; name: string } | null>;
  findBranchById(branchId: string, tenantId: string): Promise<{ id: string } | null>;
  create(data: CreateUserRecord): Promise<UserRecord>;
  update(id: string, data: UpdateUserRecord): Promise<UserRecord>;
  delete(id: string): Promise<void>;
}
