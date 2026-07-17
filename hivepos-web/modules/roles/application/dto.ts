export interface RoleDTO {
  id: string;
  name: string;
  description: string | null;
  color: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  userCount: number;
}

export interface CreateRoleInput {
  name: string;
  description: string | null;
  color?: string;
  permissions: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
  color?: string;
  permissions?: string[];
}
