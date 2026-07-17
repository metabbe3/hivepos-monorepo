"use client";

import { SessionProvider } from "next-auth/react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionGuard } from "@/components/shared/session-guard";
import { ImpersonationBanner } from "@/components/shared/impersonation-banner";
import { DemoBanner } from "@/components/shared/demo-banner";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { OfflineSyncManager } from "@/components/shared/offline-sync-manager";
import { TelemetryFlusher } from "@/components/shared/telemetry-flusher";
import { I18nProvider } from "@/lib/i18n-context";
import { useSessionSync } from "@/hooks/use-session-sync";

function SessionSyncWrapper({ children }: { children: React.ReactNode }) {
  useSessionSync();
  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionSyncWrapper>
        <SessionGuard>
          <I18nProvider>
            <TooltipProvider>
              <OfflineSyncManager />
              <TelemetryFlusher />
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                  <OfflineBanner />
                  <ImpersonationBanner />
                  <DemoBanner />
                  <Header />
                  <main className="flex-1 overflow-x-hidden bg-background p-4 md:p-6">{children}</main>
                </SidebarInset>
              </SidebarProvider>
            </TooltipProvider>
          </I18nProvider>
        </SessionGuard>
      </SessionSyncWrapper>
    </SessionProvider>
  );
}
