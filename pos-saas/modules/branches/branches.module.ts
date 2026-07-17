import { PrismaBranchRepository } from "./infrastructure/prisma-branch.repository";
import {
  ListBranchesService,
  GetBranchService,
  CreateBranchService,
  UpdateBranchService,
} from "./application/branch-services";

const branchRepo = new PrismaBranchRepository();

export const listBranchesService = new ListBranchesService(branchRepo);
export const getBranchService = new GetBranchService(branchRepo);
export const createBranchService = new CreateBranchService(branchRepo);
export const updateBranchService = new UpdateBranchService(branchRepo);
