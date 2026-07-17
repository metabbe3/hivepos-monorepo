import { prisma } from "@/lib/prisma";
import type { CustomerPort } from "../domain/repository.port";

/**
 * Narrow port for find-or-create-by-phone within the convert-to-order flow.
 *
 * The customer's `phone` is unique per branch (see `@@unique([branchId, phone])`
 * in the schema), so this lookup is scoped to a single branch.
 */
export class PrismaCustomerPort implements CustomerPort {
  async findByPhone(
    phone: string,
    branchId: string,
  ): Promise<{ id: string } | null> {
    const customer = await prisma.customer.findFirst({
      where: { phone, branchId },
      select: { id: true },
    });
    return customer;
  }

  async create(input: {
    name: string;
    phone: string;
    email?: string | null;
    branchId: string;
    tenantId: string;
  }): Promise<{ id: string }> {
    const customer = await prisma.customer.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        branchId: input.branchId,
      },
      select: { id: true },
    });
    return customer;
  }
}
