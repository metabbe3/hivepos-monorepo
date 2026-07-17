import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { PaymentMarquee } from "@/components/landing/PaymentMarquee";
import { IndustriesSection } from "@/components/landing/IndustriesSection";
import { FeatureBento } from "@/components/landing/FeatureBento";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PricingSection } from "@/components/landing/PricingSection";
import { WebsiteSpotlight } from "@/components/landing/WebsiteSpotlight";
import { BetaPartnerCTA } from "@/components/landing/BetaPartnerCTA";
import { LandingFAQ } from "@/components/landing/LandingFAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { SAAS_FAQS } from "@/lib/landing-data-saas";

export const metadata: Metadata = {
  title: "hivePOS — Kasir Laundry Online | Alternatif Moka POS untuk UMKM",
  description:
    "Aplikasi kasir laundry termurah untuk UMKM Indonesia. Browser-native, tanpa install. Kiloan, satuan, WhatsApp order, multi-outlet. Gratis 1 outlet. Alternatif Moka POS mulai Rp 49K/outlet.",
  alternates: { canonical: "/" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: SAAS_FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "hivePOS",
  description: "Aplikasi kasir laundry untuk UMKM Indonesia. Browser-native, tanpa install. Kiloan, satuan, WhatsApp order, multi-outlet.",
  url: "https://hivepos.id",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web Browser",
  offers: [
    { "@type": "Offer", price: "0", priceCurrency: "IDR", description: "Free — 1 outlet, 2 staff, 100 order/bulan" },
    { "@type": "Offer", price: "49000", priceCurrency: "IDR", description: "Growth — Rp 49K/outlet/bulan, unlimited" },
    { "@type": "Offer", price: "79000", priceCurrency: "IDR", description: "Pro — Rp 79K/outlet/bulan, website + foto bukti" },
  ],
  featureList: [
    "Kasir laundry kiloan, satuan, express",
    "Cetak struk thermal (Bluetooth/USB/WiFi)",
    "WhatsApp order + template pesanan",
    "Multi-outlet dengan dashboard terpisah",
    "Manajemen pelanggan + dompet deposit",
    "Pickup/antar-jemput gratis",
    "PWA: install di HP, order offline",
    "Website laundry sendiri (Pro)",
    "Bukti foto order (Pro)",
  ],
};

export default function LandingPage() {
  return (
    <div className="pub-scope min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingNav />
      <div>
        <LandingHero />
        <PaymentMarquee />
        <IndustriesSection />
        <FeatureBento />
        <HowItWorks />
        <PricingSection />
        <WebsiteSpotlight />
        <BetaPartnerCTA />
        <LandingFAQ />
        <FinalCTA />
      </div>
      <LandingFooter />
    </div>
  );
}
