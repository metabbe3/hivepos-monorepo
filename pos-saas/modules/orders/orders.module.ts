/**
 * Composition root for the Orders module.
 *
 * Wires the infrastructure repository implementations into the application
 * services. API routes import these singleton instances instead of
 * constructing services inline.
 *
 * Importing this file pulls in Prisma (infrastructure), so domain and
 * application layers must NOT import it — they depend only on interfaces.
 */

import { PrismaOrderRepository } from "./infrastructure/prisma-order.repository";
import { PrismaPaymentRepository } from "./infrastructure/prisma-payment.repository";
import { PrismaServiceCatalog } from "./infrastructure/prisma-service-catalog";
import { PrismaBranchPort } from "./infrastructure/prisma-branch.port";
import { PrismaTenantPort } from "./infrastructure/prisma-tenant.port";
import { BillingOrderLimitPort } from "./infrastructure/billing-order-limit.port";
import { PrismaCustomerLookupPort } from "./infrastructure/prisma-customer-lookup.port";
import { CreateOrderService } from "./application/create-order.service";
import { UpdateOrderService } from "./application/update-order.service";
import { RecordPaymentService } from "./application/record-payment.service";
import { AdvanceStatusService } from "./application/advance-status.service";
import {
  UpdateNotesService,
  GetOrderService,
  ListOrdersService,
  DeleteOrderService,
} from "./application/simple-services";

// ── Infrastructure singletons ──
const orderRepo = new PrismaOrderRepository();
const paymentRepo = new PrismaPaymentRepository();
const serviceCatalog = new PrismaServiceCatalog();
const branchPort = new PrismaBranchPort();
const tenantPort = new PrismaTenantPort();
const limitPort = new BillingOrderLimitPort();
const customerLookup = new PrismaCustomerLookupPort();

// ── Application services (wired with their dependencies) ──
export const createOrderService = new CreateOrderService(
  orderRepo,
  serviceCatalog,
  branchPort,
  limitPort,
  tenantPort,
  customerLookup,
);

export const updateOrderService = new UpdateOrderService(
  orderRepo,
  serviceCatalog,
  tenantPort,
);

export const recordPaymentService = new RecordPaymentService(orderRepo, paymentRepo);

export const advanceStatusService = new AdvanceStatusService(orderRepo);

export const updateNotesService = new UpdateNotesService(orderRepo);

export const getOrderService = new GetOrderService(orderRepo);

export const listOrdersService = new ListOrdersService(orderRepo);

export const deleteOrderService = new DeleteOrderService(orderRepo);

export {
  orderRepo,
  paymentRepo,
  serviceCatalog,
  branchPort,
  limitPort,
};
