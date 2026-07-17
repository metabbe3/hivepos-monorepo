import { getApiSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function getBranchFilter() {
  const session = await getApiSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const branchId = session.user.branchId;
  const tenantId = session.user.tenantId;

  if (branchId === "ALL") {
    const branches = await prisma.branch.findMany({
      where: { tenantId, isActive: true },
      select: { id: true },
    });
    return {
      branchId: "ALL",
      branchIds: branches.map((b) => b.id),
      tenantId,
      session,
      isAllOutlets: true as const,
    };
  }

  return {
    branchId,
    branchIds: [branchId],
    tenantId,
    session,
    isAllOutlets: false as const,
  };
}
