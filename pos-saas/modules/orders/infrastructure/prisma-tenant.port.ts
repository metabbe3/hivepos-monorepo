import { prisma } from "@/lib/prisma";
import type { TenantPort } from "../application/ports";

// ponytail: one-method port. Adds a tenant-slug read per order create/update
// so order numbers can be prefixed with the tenant code (HBL-20260621-0001).
// Indexed lookup, negligible cost. If other tenant fields are needed later,
// extend this port — don't add a parallel one.
export class PrismaTenantPort implements TenantPort {
  async getSlug(tenantId: string): Promise<string | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    return tenant?.slug ?? null;
  }
}
