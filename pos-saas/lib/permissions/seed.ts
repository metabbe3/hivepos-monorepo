/**
 * Helpers for seeding default roles into a tenant and for ensuring every
 * tenant user is linked to a Role row (migrating off the legacy enum).
 *
 * Used by:
 * - scripts/seed-rbac.ts (backfill existing tenants)
 * - prisma/seed.ts (demo tenant)
 * - app/api/register/route.ts (new tenant registration)
 */

import type { Prisma, PrismaClient } from "../../app/generated/prisma/client";
import { DEFAULT_ROLES, legacyRoleToDefaultName } from "./defaults";

/**
 * Idempotently seed the 4 system roles for a tenant.
 * Returns a map of role name → role id.
 */
export async function seedDefaultRoles(
  tx: Prisma.TransactionClient | PrismaClient,
  tenantId: string,
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  for (const def of DEFAULT_ROLES) {
    const existing = await tx.role.findFirst({
      where: { tenantId, name: def.name },
      select: { id: true },
    });

    if (existing) {
      map[def.name] = existing.id;
      // For the Owner role we always re-pin permissions to the wildcard, since
      // the owner must never be locked out by an accidental edit.
      if (def.name === "Owner") {
        await tx.role.update({
          where: { id: existing.id },
          data: { permissions: def.permissions, isSystem: true },
        });
      }
      continue;
    }

    const created = await tx.role.create({
      data: {
        tenantId,
        name: def.name,
        description: def.description,
        isSystem: def.isSystem,
        permissions: def.permissions as string[],
        color: def.color,
      },
    });
    map[def.name] = created.id;
  }

  return map;
}

/**
 * Ensure every tenant user has a roleId set. Users without one are mapped
 * from their legacy `role` enum to the matching default role. Safe to
 * call repeatedly.
 */
export async function backfillUserRoles(
  tx: Prisma.TransactionClient | PrismaClient,
  tenantId: string,
  roleMap: Record<string, string>,
): Promise<number> {
  const users = await tx.user.findMany({
    where: { tenantId, roleId: null },
    select: { id: true, role: true },
  });

  let updated = 0;
  for (const u of users) {
    const roleName = legacyRoleToDefaultName(u.role as "OWNER" | "MANAGER" | "EMPLOYEE");
    const roleId = roleMap[roleName];
    if (!roleId) continue;
    await tx.user.update({ where: { id: u.id }, data: { roleId } });
    updated++;
  }

  return updated;
}
