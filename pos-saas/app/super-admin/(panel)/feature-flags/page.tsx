import { Flag } from "lucide-react";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { FlagsManager } from "./flags-manager";
import { PageHeader } from "@/components/super-admin";

export default async function FeatureFlagsPage() {
  await requireSuperAdminPanelSession();

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Operations"
        title="Feature Flags"
        subtitle="Control feature availability per tenant — global toggle, whitelist, or blacklist."
        icon={Flag}
      />
      <FlagsManager />
    </div>
  );
}
