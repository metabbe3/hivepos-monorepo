/** Role record returned by the repository. */
export interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  color: string;
  permissions: string[];
  isSystem: boolean;
  tenantId: string;
  createdAt: Date;
  userCount: number;
}
