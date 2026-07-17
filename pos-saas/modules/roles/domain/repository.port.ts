import type { RoleRecord } from "./types";

export interface CreateRoleRecord {
  name: string;
  description: string | null;
  color: string;
  permissions: string[];
  tenantId: string;
}

export interface UpdateRoleRecord {
  name?: string;
  description?: string | null;
  color?: string;
  permissions?: string[];
}

export interface RoleRepository {
  findMany(tenantId: string): Promise<RoleRecord[]>;
  findById(id: string, tenantId: string): Promise<RoleRecord | null>;
  create(data: CreateRoleRecord): Promise<RoleRecord>;
  update(id: string, data: UpdateRoleRecord): Promise<RoleRecord>;
  delete(id: string): Promise<void>;
  reassignUsersToNull(roleId: string): Promise<void>;
  bumpSessionVersionForRole(roleId: string): Promise<void>;
}
