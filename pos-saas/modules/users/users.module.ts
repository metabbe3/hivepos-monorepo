import { PrismaUserRepository } from "./infrastructure/prisma-user.repository";
import {
  ListUsersService,
  CreateUserService,
  UpdateUserService,
  DeleteUserService,
} from "./application/user-services";

const userRepo = new PrismaUserRepository();

export const listUsersService = new ListUsersService(userRepo);
export const createUserService = new CreateUserService(userRepo);
export const updateUserService = new UpdateUserService(userRepo);
export const deleteUserService = new DeleteUserService(userRepo);
