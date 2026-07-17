import { Tag } from "lucide-react";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { PromoCodesManager } from "./promo-codes-manager";
import { PageHeader } from "@/components/super-admin";

export default async function PromoCodesPage() {
  await requireSuperAdminPanelSession();

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Customers"
        title="Promo Codes"
        subtitle="Promo codes for tenant subscriptions."
        icon={Tag}
      />
      <PromoCodesManager />
    </div>
  );
}
