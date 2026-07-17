"use client";

import { Settings as SettingsIcon } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { SettingsManager } from "./settings-manager";
import { PageHeader } from "@/components/super-admin";

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = (session?.user ?? {}) as Record<string, any>;

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
          id: user.id ?? "",
          email: user.email ?? "",
          name: user.name ?? "",
          role: user.role,
        }}
      />
    </div>
  );
}
