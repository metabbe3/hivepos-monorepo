import { PrismaCustomerRepository } from "./infrastructure/prisma-customer.repository";
import { PrismaDepositRepository } from "./infrastructure/prisma-deposit.repository";
import { PrismaCustomerStatsRepository } from "./infrastructure/prisma-customer-stats.repository";
import { ListCustomersService } from "./application/list-customers.service";
import { CreateCustomerService } from "./application/create-customer.service";
import {
  GetCustomerService,
  UpdateCustomerService,
  DeleteCustomerService,
} from "./application/simple-services";
import {
  TopUpDepositService,
  ListDepositTransactionsService,
} from "./application/top-up-deposit.service";
import { CustomerStatsService } from "./application/customer-stats.service";

// ── Infrastructure singletons ──────────────────────────────────────────
const customerRepo = new PrismaCustomerRepository();
const depositRepo = new PrismaDepositRepository();
const statsRepo = new PrismaCustomerStatsRepository();

// ── Application service singletons ─────────────────────────────────────
export const listCustomersService = new ListCustomersService(customerRepo);
export const createCustomerService = new CreateCustomerService(customerRepo);
export const getCustomerService = new GetCustomerService(customerRepo);
export const updateCustomerService = new UpdateCustomerService(customerRepo);
export const deleteCustomerService = new DeleteCustomerService(customerRepo);
export const topUpDepositService = new TopUpDepositService(depositRepo, customerRepo);
export const listDepositTransactionsService = new ListDepositTransactionsService(depositRepo);
export const customerStatsService = new CustomerStatsService(statsRepo, customerRepo);

// ponytail: exported for the /api/customers route to do idempotency + phone
// dedup lookups inline before delegating to CreateCustomerService.
export { customerRepo };
