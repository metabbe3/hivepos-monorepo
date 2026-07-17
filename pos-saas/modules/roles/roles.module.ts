import { PrismaRoleRepository } from "./infrastructure/prisma-role.repository";
import {
  ListRolesService,
  GetRoleService,
  CreateRoleService,
  UpdateRoleService,
  DeleteRoleService,
} from "./application/role-services";

const roleRepo = new PrismaRoleRepository();

export const listRolesService = new ListRolesService(roleRepo);
export const getRoleService = new GetRoleService(roleRepo);
export const createRoleService = new CreateRoleService(roleRepo);
export const updateRoleService = new UpdateRoleService(roleRepo);
export const deleteRoleService = new DeleteRoleService(roleRepo);
