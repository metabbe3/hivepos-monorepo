import { Settings as SettingsIcon } from "lucide-react";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { SettingsManager } from "./settings-manager";
import { PageHeader } from "@/components/super-admin";

export default async function SettingsPage() {
  const session = await requireSuperAdminPanelSession();

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Operations"
        title="Settings"
        subtitle="Your own admin account."
        icon={SettingsIcon}
      />

      <SettingsManager
        admin={{
          id: (session.user as any).id ?? "",
          email: (session.user as any).email ?? "",
          name: (session.user as any).name ?? "",
          role: (session.user as any).role,
        }}
      />
    </div>
  );
}
