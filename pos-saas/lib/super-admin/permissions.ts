import { getApiSession } from "@/lib/get-session";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  UnauthenticatedError,
  ForbiddenError,
} from "@/modules/shared";
import type { Session } from "next-auth";

/**
 * Canonical super-admin auth gate for API routes.
 * Throws UnauthenticatedError if no session, ForbiddenError if role insufficient.
 *
 *   const { session } = await assertSuperAdminOrThrow();          // SUPER_ADMIN or SUPPORT
 *   const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN"); // strict
 */
export async function assertSuperAdminOrThrow(
  requiredRole?: "SUPER_ADMIN" | "SUPPORT",
): Promise<{ session: Session }> {
  const session = (await getApiSession()) as any;
  if (!session?.user) throw new UnauthenticatedError();

  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "SUPPORT") {
    throw new ForbiddenError("Super admin access required");
  }
  if (requiredRole && role !== requiredRole) {
    throw new ForbiddenError(`${requiredRole} role required`);
  }
  return { session };
}

/**
 * Page-level guard for /super-admin/(panel)/** routes.
 * Call at the top of each panel page's server component.
 *
 *   const session = await requireSuperAdminPanelSession();
 *   // ...render...
 */
export async function requireSuperAdminPanelSession() {
  const session = await auth();
  if (!session?.user) redirect("/super-admin/login");

  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN" && role !== "SUPPORT") {
    redirect("/dashboard");
  }
  return session;
}
