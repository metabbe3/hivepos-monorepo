import { ShieldCheck } from "lucide-react";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { AdminsManager } from "./admins-manager";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/super-admin";

export default async function AdminsPage() {
  const session = await requireSuperAdminPanelSession();

  const admins = await prisma.superAdmin.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Operations"
        title="Admin Accounts"
        subtitle="Who has access to this panel."
        icon={ShieldCheck}
      />

      <AdminsManager
        admins={admins.map((a) => ({
          id: a.id,
          email: a.email,
          name: a.name,
          role: a.role,
          createdAt: a.createdAt.toISOString(),
        }))}
        currentAdminId={session.user.id ?? ""}
      />
    </div>
  );
}
