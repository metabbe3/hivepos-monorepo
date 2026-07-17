/**
 * Composition root for the Pickup Requests module.
 *
 * Wires the infrastructure repository implementations into the application
 * services. API routes import these singleton instances instead of
 * constructing services inline.
 *
 * The convert-to-order service depends on the orders module's
 * `createOrderService` — that cross-module wiring happens here too.
 *
 * Importing this file pulls in Prisma (infrastructure), so domain and
 * application layers must NOT import it — they depend only on interfaces.
 */

import { PrismaPickupRequestRepository } from "./infrastructure/prisma-pickup-request.repository";
import { PrismaBranchPort } from "./infrastructure/prisma-branch.port";
import { PrismaCustomerPort } from "./infrastructure/prisma-customer.port";
import { CreatePickupRequestService } from "./application/create-pickup.service";
import { ListPickupRequestsService } from "./application/list-pickups.service";
import { GetPickupRequestService } from "./application/get-pickup.service";
import { AcceptPickupService } from "./application/accept-pickup.service";
import { SchedulePickupService } from "./application/schedule-pickup.service";
import { RejectPickupService } from "./application/reject-pickup.service";
import { AssignDriverService } from "./application/assign-driver.service";
import {
  ConvertPickupToOrderService,
  type OrderCreationPort,
} from "./application/convert-to-order.service";
import { CountPendingPickupsService } from "./application/count-pending.service";
import { createOrderService } from "@/modules/orders/orders.module";

// ── Infrastructure singletons ──
const pickupRepo = new PrismaPickupRequestRepository();
const branchPort = new PrismaBranchPort();
const customerPort = new PrismaCustomerPort();

/**
 * Adapter that exposes the orders module's CreateOrderService under the
 * narrow OrderCreationPort interface. Keeps the pickup application layer
 * from importing the orders module directly.
 */
const orderCreationPort: OrderCreationPort = {
  execute: async (input, ctx) => {
    const order = await createOrderService.execute(
      {
        customerId: input.customerId,
        items: input.items,
        notes: input.notes,
      },
      ctx,
    );
    return { id: order.id, orderNumber: order.orderNumber };
  },
};

// ── Application services (wired with their dependencies) ──
export const createPickupService = new CreatePickupRequestService(pickupRepo, branchPort);
export const listPickupsService = new ListPickupRequestsService(pickupRepo);
export const getPickupService = new GetPickupRequestService(pickupRepo);
export const acceptPickupService = new AcceptPickupService(pickupRepo);
export const schedulePickupService = new SchedulePickupService(pickupRepo);
export const rejectPickupService = new RejectPickupService(pickupRepo);
export const assignDriverService = new AssignDriverService(pickupRepo);
export const convertPickupService = new ConvertPickupToOrderService(
  pickupRepo,
  customerPort,
  orderCreationPort,
);
export const countPendingPickupsService = new CountPendingPickupsService(pickupRepo);

export { pickupRepo, branchPort, customerPort };
