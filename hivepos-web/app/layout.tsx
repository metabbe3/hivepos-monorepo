import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n-context";
import { PwaRegister } from "@/components/shared/pwa-register";
import { PwaForceUpdateWatcher } from "@/components/shared/pwa-force-update-watcher";
import { ClientErrorReporter } from "@/components/shared/client-error-reporter";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "hivePOS",
  description: "Kasir laundry ringan di browser, untuk UMKM Indonesia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <I18nProvider>{children}</I18nProvider>
        <PwaRegister />
        <PwaForceUpdateWatcher />
        <ClientErrorReporter />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
