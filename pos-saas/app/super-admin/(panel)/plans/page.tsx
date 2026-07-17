import { Layers } from "lucide-react";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { PlansManager } from "./plans-manager";
import { PageHeader } from "@/components/super-admin";

export default async function PlansPage() {
  await requireSuperAdminPanelSession();

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Customers"
        title="Plans"
        subtitle="Subscription plans available to tenants."
        icon={Layers}
      />
      <PlansManager />
    </div>
  );
}
