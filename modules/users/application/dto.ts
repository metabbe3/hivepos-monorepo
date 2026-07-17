import type { LegacyRole } from "../domain/types";

// ── List / detail DTO ──

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: LegacyRole;
  roleId: string | null;
  branchId: string | null;
  createdAt: string;
  branch: { id: string; name: string } | null;
  roleRef: { id: string; name: string; color: string } | null;
}

// ── Create / Update inputs (from Zod-validated body) ──

export interface CreateUserInput {
  email: string;
  name: string;
  phone: string | null;
  roleId: string;
  branchId: string;
  password: string;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string | null;
  roleId?: string;
  branchId?: string;
  password?: string;
}
