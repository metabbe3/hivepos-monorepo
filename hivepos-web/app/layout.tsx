import type { Metadata } from "next";
import Script from "next/script";
import { I18nProvider } from "@/lib/i18n-context";
import { PwaRegister } from "@/components/shared/pwa-register";
import { PwaForceUpdateWatcher } from "@/components/shared/pwa-force-update-watcher";
import { ClientErrorReporter } from "@/components/shared/client-error-reporter";
import { Toaster } from "@/components/ui/sonner";
import { GA_ID } from "@/lib/analytics";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "hivePOS",
  description: "Kasir laundry ringan di browser untuk UMKM Indonesia — kiloan, satuan, WhatsApp order, multi-outlet, QRIS, laporan, cetak struk. 1 outlet gratis selamanya, tanpa install.",
  openGraph: {
    type: "website",
    siteName: "hivePOS",
    locale: "id_ID",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
  },
  // GSC ownership verification — meta rendered only when the token is set in env.
  ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } }
    : {}),
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
        {/* GA4 — env-gated. No script/network when NEXT_PUBLIC_GA_ID is unset. */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { send_page_view: true });
            `}</Script>
          </>
        )}
      </body>
    </html>
  );
}
