"use client";

import { SessionProvider } from "next-auth/react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SuperAdminSidebar } from "@/components/layout/super-admin-sidebar";
import { SuperAdminHeader } from "@/components/layout/super-admin-header";
import { SuperAdminSessionGuard } from "@/components/shared/super-admin-session-guard";
import { SuperAdminAssistant } from "@/components/super-admin/super-admin-assistant";

// ponytail: no I18nProvider, no useSessionSync — super-admin panel is English-only
// and doesn't use tenant RBAC permissions (different role model entirely).
// ponytail: MeshBackground removed — Sharp Light Bento goes solid, no haze.
export default function SuperAdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SuperAdminSessionGuard>
        <TooltipProvider>
          <SidebarProvider>
            <SuperAdminSidebar />
            <SidebarInset>
              <SuperAdminHeader />
              <main className="relative flex-1 overflow-x-hidden bg-background p-4 md:p-6">
                <div className="mx-auto max-w-[1600px]">{children}</div>
              </main>
              <SuperAdminAssistant />
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </SuperAdminSessionGuard>
    </SessionProvider>
  );
}
