import { PrismaServiceRepository } from "./infrastructure/prisma-service.repository";
import { PrismaServiceGroupRepository } from "./infrastructure/prisma-service-group.repository";
import {
  ListServicesService,
  CreateServiceService,
  UpdateServiceService,
  DeleteServiceService,
} from "./application/service-services";
import {
  ListServiceGroupsService,
  CreateServiceGroupService,
  UpdateServiceGroupService,
  DeleteServiceGroupService,
  ReorderServiceGroupsService,
} from "./application/group-services";

// ── Infrastructure singletons ──────────────────────────────────────────
const serviceRepo = new PrismaServiceRepository();
const groupRepo = new PrismaServiceGroupRepository();

// ── Application service singletons ─────────────────────────────────────
export const listServicesService = new ListServicesService(serviceRepo);
export const createServiceService = new CreateServiceService(serviceRepo);
export const updateServiceService = new UpdateServiceService(serviceRepo);
export const deleteServiceService = new DeleteServiceService(serviceRepo);

export const listServiceGroupsService = new ListServiceGroupsService(groupRepo);
export const createServiceGroupService = new CreateServiceGroupService(groupRepo);
export const updateServiceGroupService = new UpdateServiceGroupService(groupRepo);
export const deleteServiceGroupService = new DeleteServiceGroupService(groupRepo);
export const reorderServiceGroupsService = new ReorderServiceGroupsService(groupRepo);
