import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { prisma } from "@/lib/prisma";
import { getCachedTenantBySlug, type TenantPublicData } from "@/lib/tenant-cache";
import { renderWhatsAppTemplate, type TemplateOverrides } from "@/lib/whatsapp-templates";

// ponytail: "Clean & Safe" template — off-white canvas, sky-blue accent,
// soft radii, real shadows. The visual language of trust for laundry.
//
// Security note on dangerouslySetInnerHTML usage below:
// - <style> block: 100% static CSS, no tenant data interpolated. Safe.
// - JSON-LD <script> blocks: tenant-controlled fields pass through safeJsonLd()
//   which escapes <, >, & to \u003c, \u003e, \u0026 — standard JSON-LD mitigation
//   against </script> injection. Safe.
// - Reveal observer <script>: 100% static JS, no tenant data. Safe.

const SITE_URL = "https://hivepos.id";

const jakarta = Plus_Jakarta_Sans({
  weight: ["600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const inter = Inter({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

interface Faq {
  question: string;
  answer: string;
}
interface Testimonial {
  name: string;
  role?: string;
  text: string;
  rating?: number;
}

interface WebsiteSettings {
  tagline?: string;
  heroPhotoUrl?: string;
  about?: string;
  instagram?: string;
  qrisImageUrl?: string;
  // Trust signals:
  googleRating?: number;
  googleReviewCount?: number;
  yearEstablished?: number;
  avgProcessingMinutes?: number;
  areaServed?: string[];
  // Repeatables:
  faqs?: Faq[];
  testimonials?: Testimonial[];
}

function readSettings(tenant: TenantPublicData): WebsiteSettings {
  const s = (tenant.settings as { website?: WebsiteSettings } | null)?.website ?? {};
  return s;
}

/** ponytail: extract kelurahan from a freeform address. Best-effort regex — no
 * geocoder needed. Falls back to "Jakarta" if nothing parses. */
function extractKelurahan(address: string | null): string {
  if (!address) return "Jakarta";
  const m = address.match(/kel(?:urahan|\.|ur)?\s+([A-Za-z\s]+?)[,\.]/i);
  if (m) return m[1].trim();
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return address;
}

function formatPrice(rp: number): string {
  if (rp >= 1000) return `Rp ${rp.toLocaleString("id-ID")}`;
  return `Rp ${rp}`;
}

function formatOperatingHours(hours: unknown): Array<{ day: string; dayKey: string; time: string }> {
  if (!hours || typeof hours !== "object") return [];
  const entries = hours as Record<string, string>;
  const days = ["min", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const dayLabels: Record<string, string> = {
    min: "Minggu", mon: "Senin", tue: "Selasa", wed: "Rabu",
    thu: "Kamis", fri: "Jumat", sat: "Sabtu",
  };
  return days
    .filter((d) => entries[d])
    .map((d) => ({ day: dayLabels[d] ?? d, dayKey: d, time: entries[d] }));
}

/**
 * ponytail: server-side "open now" check. Hours format like "08:00-21:00".
 * Computed at request time — stale at most TTL (60s).
 */
function computeOpenStatus(
  hours: Array<{ dayKey: string; time: string }>,
  now: Date = new Date()
): { open: boolean; label: string } {
  if (hours.length === 0) return { open: false, label: "Jam operasional belum diisi" };
  const dayKeys = ["min", "mon", "tue", "wed", "thu", "fri", "sat"];
  const todayKey = dayKeys[now.getDay()];
  const today = hours.find((h) => h.dayKey === todayKey);
  if (!today) return { open: false, label: "Hari ini tutup" };

  const [openStr, closeStr] = today.time.split("-").map((s) => s.trim());
  if (!openStr || !closeStr) return { open: false, label: "Format jam tidak valid" };

  const [oh, om] = openStr.split(":").map(Number);
  const [ch, cm] = closeStr.split(":").map(Number);
  if (Number.isNaN(oh) || Number.isNaN(ch)) return { open: false, label: "Format jam tidak valid" };

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = oh * 60 + (om || 0);
  const closeMin = ch * 60 + (cm || 0);

  if (nowMin >= openMin && nowMin < closeMin) {
    return { open: true, label: `Buka · tutup ${closeStr}` };
  }
  if (nowMin < openMin) {
    return { open: false, label: `Buka ${openStr} hari ini` };
  }
  return { open: false, label: `Tutup · buka besok` };
}

/**
 * ponytail: serialize JSON-LD with < and > escaped to \u003c/\u003e. Prevents
 * </script> injection from tenant-controlled fields (name, address, etc.) —
 * the standard mitigation for embedded structured data.
 */
function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

/** ponytail: append ?text= to wa.me link. Same pattern as lib/whatsapp.ts and
 * components/public/price-estimator.tsx. Empty base → empty string (caller
 * checks falsy before rendering). */
function buildWaUrl(base: string | null | undefined, message: string): string {
  if (!base) return "";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}text=${encodeURIComponent(message)}`;
}

function pricingLabel(type: string | null): string {
  if (type === "PER_KG") return "/ kg";
  if (type === "PER_ITEM") return "/ item";
  return "flat";
}

// ─── Icon set ──────────────────────────────────────────────────────────────
// All inline SVG. 24x24 viewBox, stroke 1.8, currentColor.
// Keep simple — no decorative noise. One icon per concept.

type IconName =
  | "sparkle" | "star" | "listChecks" | "shieldCheck" | "quote"
  | "info" | "mapPin" | "helpCircle" | "qrCode" | "phone"
  | "drop" | "clock" | "truck" | "leaf" | "badgeCheck"
  | "shirt" | "iron" | "shoe" | "blanket" | "home"
  | "messageCircle" | "whatsapp";

function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "sparkle":
      return (<svg {...p}><path d="M12 3v4M12 17v4M5 12H1M23 12h-4M6.3 6.3 4 4M20 20l-2.3-2.3M17.7 6.3 20 4M4 20l2.3-2.3" /><circle cx="12" cy="12" r="3" /></svg>);
    case "star":
      return (<svg {...p}><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" /></svg>);
    case "listChecks":
      return (<svg {...p}><path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /><path d="M13 6h8M13 12h8M13 18h8" /></svg>);
    case "shieldCheck":
      return (<svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>);
    case "quote":
      return (<svg {...p}><path d="M3 21c3 0 7-1 7-8V5c0-1-1-2-2-2H4c-1 0-2 1-2 2v6c0 1 1 2 2 2h2" /><path d="M14 21c3 0 7-1 7-8V5c0-1-1-2-2-2h-4c-1 0-2 1-2 2v6c0 1 1 2 2 2h2" /></svg>);
    case "info":
      return (<svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>);
    case "mapPin":
      return (<svg {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>);
    case "helpCircle":
      return (<svg {...p}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>);
    case "qrCode":
      return (<svg {...p}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3M21 14v.01M14 21h.01M17 21h4v-4" /></svg>);
    case "phone":
      return (<svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>);
    case "drop":
      return (<svg {...p}><path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z" /></svg>);
    case "clock":
      return (<svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>);
    case "truck":
      return (<svg {...p}><path d="M14 18V6H2v12h2" /><path d="M14 9h4l4 4v5h-2" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>);
    case "leaf":
      return (<svg {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></svg>);
    case "badgeCheck":
      return (<svg {...p}><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z" /><path d="m9 12 2 2 4-4" /></svg>);
    case "shirt":
      return (<svg {...p}><path d="M4 7l4-3h8l4 3-3 3-1-1v9H6V9L5 10z" /></svg>);
    case "iron":
      return (<svg {...p}><path d="M3 16h18l-2-5a5 5 0 0 0-5-3H8a5 5 0 0 0-5 5z" /><path d="M3 16v2M9 11h4" /></svg>);
    case "shoe":
      return (<svg {...p}><path d="M2 16h18a2 2 0 0 0 2-2v-2l-4-3-3 1-3-4-5 2-5 6z" /><path d="M2 16v2h20" /></svg>);
    case "blanket":
      return (<svg {...p}><path d="M3 4h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" /><path d="M3 8h17M3 12h17" /></svg>);
    case "home":
      return (<svg {...p}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>);
    case "messageCircle":
      return (<svg {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" /></svg>);
    case "whatsapp":
      // Filled WA glyph. Uses fill=currentColor regardless of stroke props.
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.1-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.5-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.3c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.4.5-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.8.9c.3.1.5.2.5.4.1.2.1.7-.1 1.3z" /></svg>);
    default:
      return null;
  }
}

function serviceIcon(name: string): IconName {
  const n = name.toLowerCase();
  if (n.includes("sepatu")) return "shoe";
  if (n.includes("bed") || n.includes("selimut") || n.includes("karpet")) return "blanket";
  if (n.includes("setrika") || n.includes("rika")) return "iron";
  if (n.includes("express") || n.includes("kilat")) return "sparkle";
  if (n.includes("satuan") || n.includes("item")) return "shirt";
  return "drop";
}

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  // Render 5 stars; filled for rating, muted for the rest.
  const full = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} dari 5 bintang`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={i < full ? { color: "#F59E0B" } : { color: "#CBD5E1" }}>
          <Icon name="star" size={size} />
        </span>
      ))}
    </div>
  );
}

// ─── Metadata ──────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const slug = (await headers()).get("x-tenant-slug");
  if (!slug) return { title: "Laundry Website" };

  const tenant = await getCachedTenantBySlug(slug);
  if (!tenant) return { title: "Laundry Website", robots: { index: false, follow: false } };

  const primaryBranch = tenant.branches[0];
  const kelurahan = extractKelurahan(primaryBranch?.address ?? null);
  const settings = readSettings(tenant);
  const tagline = settings.tagline ?? `Laundry kiloan selesai 3 jam di ${kelurahan}. Garansi bersih atau dicuci ulang.`;
  const subdomain = `${tenant.slug}.hivepos.id`;
  const title = `${tenant.name} — Laundry ${kelurahan} | Antar-Jemput Gratis`;
  const ogImage = settings.heroPhotoUrl ?? tenant.logoUrl ?? "/og-default.png";

  return {
    title,
    description: tagline,
    alternates: { canonical: `https://${subdomain}/` },
    openGraph: {
      type: "website",
      url: `https://${subdomain}/`,
      siteName: tenant.name,
      title,
      description: tagline,
      locale: "id_ID",
      images: [{ url: ogImage, width: 1200, height: 630, alt: tenant.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: tagline,
      images: [ogImage],
    },
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function TenantSitePage() {
  const slug = (await headers()).get("x-tenant-slug");
  if (!slug) notFound();

  const tenant = await getCachedTenantBySlug(slug);
  if (!tenant) notFound();

  const settings = readSettings(tenant);
  const primaryBranch = tenant.branches[0];
  const kelurahan = extractKelurahan(primaryBranch?.address ?? null);
  const tagline = settings.tagline ?? `Laundry kiloan selesai 3 jam di ${kelurahan}. Garansi bersih atau dicuci ulang.`;
  const about = settings.about ?? `${tenant.name} melayani cuci kiloan, satuan, setrika, dan cuci sepatu di ${kelurahan} dan sekitarnya. Pickup gratis, hasil terjamin, harga transparan.`;
  const hours = formatOperatingHours(primaryBranch?.operatingHours);
  const openStatus = computeOpenStatus(hours);
  const subdomain = `${tenant.slug}.hivepos.id`;
  const waLink = primaryBranch?.whatsappLink;
  const whatsappTemplates: TemplateOverrides =
    ((tenant.settings as { whatsappTemplates?: TemplateOverrides } | null)?.whatsappTemplates) ?? {};

  // ponytail: two WA intents from a single stored link. Order = pre-filled
  // "mau pesan"; Ask = pre-filled "mau tanya". Floating + nav use order.
  const waOrder = waLink
    ? buildWaUrl(waLink, renderWhatsAppTemplate("tenantSite.orderCta", { tenantName: tenant.name }, whatsappTemplates))
    : "";
  const waAsk = waLink
    ? buildWaUrl(waLink, renderWhatsAppTemplate("tenantSite.askCta", { tenantName: tenant.name }, whatsappTemplates))
    : "";

  const services = await prisma.service.findMany({
    where: {
      branch: { tenantId: tenant.id, isActive: true },
      isActive: true,
    },
    select: { name: true, description: true, pricingType: true, basePrice: true },
    orderBy: { basePrice: "asc" },
    take: 12,
  });

  const priceRange =
    services.length > 0
      ? `${formatPrice(Number(services[0].basePrice))}–${formatPrice(Number(services[services.length - 1].basePrice))}`
      : null;

  // ponytail: trust bar — only show stats that are actually set. Empty array
  // = no bar rendered. Avoids "0" or empty placeholders.
  const trustStats: Array<{ label: string; value: string }> = [];
  if (settings.googleRating && settings.googleRating > 0) {
    const reviewSuffix = settings.googleReviewCount ? ` (${settings.googleReviewCount})` : "";
    trustStats.push({ label: "Rating Google", value: `★ ${settings.googleRating.toFixed(1)}${reviewSuffix}` });
  }
  if (settings.avgProcessingMinutes && settings.avgProcessingMinutes > 0) {
    const hrs = settings.avgProcessingMinutes / 60;
    const display = hrs >= 1 ? `${hrs.toFixed(hrs % 1 === 0 ? 0 : 1)} jam` : `${settings.avgProcessingMinutes} menit`;
    trustStats.push({ label: "Waktu proses", value: `± ${display}` });
  }
  if (settings.yearEstablished && settings.yearEstablished > 1900) {
    const years = new Date().getFullYear() - settings.yearEstablished;
    if (years > 0) trustStats.push({ label: "Berpengalaman", value: `${years}+ tahun` });
  }

  // Process steps — hardcoded smart default. Laundry industry standard flow.
  const processSteps = [
    { icon: "messageCircle" as IconName, title: "Pesan", text: "Chat WhatsApp atau mampir ke outlet." },
    { icon: "truck" as IconName, title: "Pickup", text: `Jemput gratis area ${kelurahan}.` },
    { icon: "drop" as IconName, title: "Cuci + setrika", text: "Proses 3–6 jam, tergantung layanan." },
    { icon: "home" as IconName, title: "Antar", text: "Kurir kabar sebelum sampai." },
  ];

  // Why-us cards — smart defaults. Card 4 swaps if no yearEstablished.
  const whyUsCards: Array<{ icon: IconName; title: string; text: string }> = [
    { icon: "shieldCheck", title: "Garansi hasil", text: "Tidak bersih? Cuci ulang gratis." },
    { icon: "clock", title: "Cepat", text: "Express 3 jam, reguler 1 hari." },
    { icon: "leaf", title: "Wangi tahan lama", text: "Parfum premium, hypoallergenic." },
    settings.yearEstablished && settings.yearEstablished > 1900
      ? { icon: "badgeCheck", title: "Terpercaya", text: `Sudah melayani ${kelurahan} sejak ${settings.yearEstablished}.` }
      : { icon: "badgeCheck", title: "Handal", text: "Staf terlatih, proses standar." },
    { icon: "truck", title: "Pickup gratis", text: "Minimal order Rp 30.000." },
    { icon: "sparkle", title: "Rapi sempurna", text: "Setrika rapi, lipat rapi, plastik rapi." },
  ];

  // Testimonials — only render if tenant has set them. No fake defaults.
  const testimonials: Testimonial[] = (settings.testimonials ?? []).filter((t) => t.name && t.text);

  // FAQ — smart default if tenant hasn't configured any.
  const faqs: Faq[] =
    settings.faqs && settings.faqs.length > 0
      ? settings.faqs.filter((f) => f.question && f.answer)
      : [
          {
            question: "Berapa lama proses cuci kiloan?",
            answer: "Reguler 1 hari (next day), express 3 jam. Waktu proses dimulai setelah cucian diterima outlet.",
          },
          {
            question: "Apakah ada biaya antar-jemput?",
            answer: `Gratis untuk minimal order Rp 30.000 di area ${kelurahan} dan sekitarnya. Jarak jauh silakan tanya via WhatsApp.`,
          },
          {
            question: "Bagaimana jika hasilnya kurang bersih?",
            answer: "Kami cuci ulang gratis. Garansi kepuasan berlaku untuk semua layanan kiloan dan satuan.",
          },
          {
            question: "Metode pembayaran apa saja yang diterima?",
            answer: "Tunai, transfer bank, QRIS, dan e-wallet (OVO, GoPay, DANA). Pembayaran saat pengambilan atau pengantaran.",
          },
        ];

  // JSON-LD: LocalBusiness + aggregateRating + OfferCatalog
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "LaundryOrDryCleaning"],
    name: tenant.name,
    image: settings.heroPhotoUrl ?? tenant.logoUrl ?? undefined,
    url: `https://${subdomain}/`,
    telephone: primaryBranch?.phone ?? undefined,
    address: primaryBranch?.address
      ? {
          "@type": "PostalAddress",
          streetAddress: primaryBranch.address,
          addressCountry: "ID",
          addressRegion: "DKI Jakarta",
        }
      : undefined,
    geo:
      primaryBranch?.latitude && primaryBranch?.longitude
        ? {
            "@type": "GeoCoordinates",
            latitude: primaryBranch.latitude,
            longitude: primaryBranch.longitude,
          }
        : undefined,
    openingHoursSpecification: hours.map((h) => {
      const dayMap: Record<string, string> = {
        min: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday",
        thu: "Thursday", fri: "Friday", sat: "Saturday",
      };
      const [opens, closes] = h.time.split("-").map((s) => s.trim());
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: dayMap[h.dayKey] ?? h.day,
        opens: opens ?? "00:00",
        closes: closes ?? "23:59",
      };
    }),
    priceRange: priceRange ?? undefined,
    areaServed: settings.areaServed?.length
      ? settings.areaServed.map((a) => ({ "@type": "Place", name: a }))
      : [{ "@type": "Place", name: kelurahan }],
    aggregateRating:
      settings.googleRating && settings.googleRating > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: settings.googleRating,
            reviewCount: settings.googleReviewCount ?? undefined,
            bestRating: 5,
          }
        : undefined,
    hasOfferCatalog: services.length
      ? {
          "@type": "OfferCatalog",
          name: "Layanan Laundry",
          itemListElement: services.map((svc) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: svc.name,
              description: svc.description ?? undefined,
            },
            price: Number(svc.basePrice),
            priceCurrency: "IDR",
          })),
        }
      : undefined,
  };

  // FAQ JSON-LD — always present (smart defaults ensure at least 4 items).
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  // Testimonial JSON-LD — only when tenant has them.
  const reviewLd = testimonials.length
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: `Layanan Laundry ${tenant.name}`,
        review: testimonials.map((t) => ({
          "@type": "Review",
          author: { "@type": "Person", name: t.name },
          reviewBody: t.text,
          reviewRating: t.rating
            ? { "@type": "Rating", ratingValue: t.rating, bestRating: 5 }
            : undefined,
        })),
      }
    : null;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "hivePOS", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: kelurahan, item: `https://${subdomain}/` },
    ],
  };

  const fontClass = `${jakarta.variable} ${inter.variable}`;

  const mapEmbedUrl =
    primaryBranch?.latitude && primaryBranch?.longitude
      ? `https://www.google.com/maps?q=${primaryBranch.latitude},${primaryBranch.longitude}&z=16&output=embed`
      : null;

  // Static CSS — no tenant data interpolated here. Safe.
  const styleCss = `
    .pub-scope {
      --brand: #0284C7;
      --brand-deep: #0369A1;
      --brand-soft: #BAE6FD;
      --accent: #16A34A;
      --accent-deep: #15803D;
      --ink: #0F172A;
      --ink-2: #334155;
      --muted: #64748B;
      --border: #E2E8F0;
      --surface: #FFFFFF;
      --surface-2: #F0F9FF;
      --bg: #FFFFFF;
      --success: #16A34A;
      --violet: #7C3AED;
      --emerald: #059669;
      --amber: #D97706;
    }
    .pub-scope .font-display { font-family: var(--font-display), system-ui, sans-serif; }
    .pub-scope .font-mono-label { font-family: ui-monospace, monospace; }
    .pub-scope a:focus-visible,
    .pub-scope button:focus-visible,
    .pub-scope summary:focus-visible,
    .pub-scope [tabindex]:focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 3px;
      border-radius: 6px;
    }
    .pub-scope .eyebrow {
      font-family: ui-monospace, monospace;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--brand);
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .pub-scope .service-card {
      transition: transform 220ms ease-out, box-shadow 220ms ease-out, border-color 220ms ease-out;
    }
    @media (hover: hover) {
      .pub-scope .service-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 16px 40px -8px rgba(2, 132, 199, 0.25);
        border-color: var(--brand);
      }
    }
    .pub-scope .cta-primary {
      background: var(--accent);
      color: #fff;
      transition: background 180ms ease-out, transform 120ms ease-out;
    }
    @media (hover: hover) {
      .pub-scope .cta-primary:hover { background: var(--accent-deep); }
    }
    .pub-scope .cta-primary:active { transform: scale(0.98); }
    .pub-scope .cta-ghost {
      background: #fff;
      color: var(--ink-2);
      border: 1px solid var(--border);
      transition: border-color 180ms ease-out, color 180ms ease-out;
    }
    @media (hover: hover) {
      .pub-scope .cta-ghost:hover { border-color: var(--brand-soft); color: var(--brand-deep); }
    }
    .pub-scope .reveal {
      opacity: 0;
      transform: translateY(16px);
      transition: opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .pub-scope .reveal.is-visible { opacity: 1; transform: translateY(0); }
    @media (prefers-reduced-motion: reduce) {
      .pub-scope *, .pub-scope *::before, .pub-scope *::after {
        transition: none !important;
        animation: none !important;
      }
      .pub-scope .reveal { opacity: 1; transform: none; }
    }
    .pub-scope .hero-gradient {
      background: linear-gradient(135deg, #0284C7 0%, #0369A1 50%, #075985 100%);
      color: #fff;
    }
    .pub-scope .hero-gradient h1,
    .pub-scope .hero-gradient h2,
    .pub-scope .hero-gradient p,
    .pub-scope .hero-gradient span {
      color: #fff !important;
    }
    .pub-scope .hero-gradient .eyebrow { color: rgba(255,255,255,0.85) !important; }
    .pub-scope .hero-gradient .cta-primary {
      background: #fff !important;
      color: var(--accent) !important;
    }
    .pub-scope .hero-gradient .cta-primary:hover { background: rgba(255,255,255,0.92) !important; }
    .pub-scope .hero-gradient .cta-ghost {
      background: rgba(255,255,255,0.15) !important;
      color: #fff !important;
      border-color: rgba(255,255,255,0.35) !important;
    }
    .pub-scope .hero-gradient .cta-ghost:hover {
      background: rgba(255,255,255,0.25) !important;
      border-color: rgba(255,255,255,0.5) !important;
    }
    .pub-scope .hero-gradient a:not(.cta-primary):not(.cta-ghost) {
      color: rgba(255,255,255,0.9) !important;
    }
    .pub-scope .floating-wa {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 50;
      box-shadow: 0 8px 24px -4px rgba(37, 211, 102, 0.45);
    }
    @media (min-width: 768px) {
      .pub-scope .floating-wa { right: 32px; bottom: 32px; }
    }
    .pub-scope .mobile-cta-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 50;
      padding: 12px 16px max(12px, env(safe-area-inset-bottom));
      background: #fff;
      border-top: 1px solid var(--border);
      box-shadow: 0 -4px 16px -4px rgba(0,0,0,0.08);
    }
    @media (min-width: 768px) {
      .pub-scope .mobile-cta-bar { display: none; }
    }
    .pub-scope details > summary {
      list-style: none;
      cursor: pointer;
    }
    .pub-scope details > summary::-webkit-details-marker { display: none; }
    .pub-scope details[open] .faq-chevron { transform: rotate(180deg); }
    .pub-scope .faq-chevron { transition: transform 200ms ease-out; }
    .pub-scope .cta-banner {
      background: linear-gradient(135deg, #0284C7 0%, #075985 100%);
      color: #fff;
    }
    .pub-scope .process-line::before {
      content: "";
      position: absolute;
      top: 28px;
      left: 10%;
      right: 10%;
      height: 2px;
      background: var(--border);
      z-index: 0;
    }
    @media (max-width: 767px) {
      .pub-scope .process-line::before { display: none; }
    }
  `;

  // Static JS for reveal observer — no tenant data. Safe.
  const revealJs = `
    (function() {
      if (typeof window === 'undefined') return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.querySelectorAll('.pub-scope .reveal').forEach(function(el) { el.classList.add('is-visible'); });
        return;
      }
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(e) {
          if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
      window.addEventListener('load', function() {
        document.querySelectorAll('.pub-scope .reveal').forEach(function(el) { io.observe(el); });
      });
    })();
  `;

  return (
    <div
      className={`pub-scope ${fontClass} min-h-screen bg-white text-[#0F172A]`}
      style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}
    >
      <style dangerouslySetInnerHTML={{ __html: styleCss }} />

      {/* JSON-LD: tenant data escaped via safeJsonLd() */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqLd) }} />
      {reviewLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(reviewLd) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />

      {/* Static reveal-on-scroll observer */}
      <script dangerouslySetInnerHTML={{ __html: revealJs }} />

      {/* ─── Nav ─── */}
      <nav className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 sm:px-10 py-4 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-3 min-w-0">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                width={36}
                height={36}
                className="h-9 w-9 rounded-lg object-cover border border-[#E2E8F0]"
              />
            ) : (
              <div
                aria-hidden
                className="h-9 w-9 rounded-lg flex items-center justify-center font-display font-bold text-white"
                style={{ background: "linear-gradient(135deg, #0284C7, #075985)" }}
              >
                {tenant.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-display font-bold text-base sm:text-lg truncate text-[#0F172A]">
              {tenant.name}
            </span>
          </a>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="#layanan" className="hidden sm:inline-block text-sm font-medium text-[#334155] hover:text-[#0284C7] transition-colors px-3 py-2">Layanan</a>
            <a href="#proses" className="hidden md:inline-block text-sm font-medium text-[#334155] hover:text-[#0284C7] transition-colors px-3 py-2">Proses</a>
            <a href="#faq" className="hidden md:inline-block text-sm font-medium text-[#334155] hover:text-[#0284C7] transition-colors px-3 py-2">FAQ</a>
            <a href="#lokasi" className="hidden sm:inline-block text-sm font-medium text-[#334155] hover:text-[#0284C7] transition-colors px-3 py-2">Lokasi</a>
            {waOrder && (
              <a
                href={waOrder}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-primary inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
              >
                <Icon name="whatsapp" size={16} />
                <span className="hidden sm:inline">Pesan via WhatsApp</span>
                <span className="sm:hidden">Pesan</span>
              </a>
            )}
          </div>
        </div>
      </nav>

      <main id="top">
        {/* ─── Hero ─── */}
        <header className="hero-gradient relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-6 sm:px-10 py-16 sm:py-24 md:py-28">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 items-center">
              <div className="md:col-span-7">
                <div className="eyebrow">
                  <Icon name="sparkle" size={14} />
                  {tenant.name}
                </div>
                <h1
                  className="font-display mt-5 font-extrabold tracking-tight leading-[1.05] text-[#0F172A]"
                  style={{ fontSize: "clamp(2.25rem, 5.5vw, 4rem)" }}
                >
                  Cucian bersih,<br />
                  <span style={{ color: "var(--brand)" }}>wangi, rapi</span> hari ini.
                </h1>
                <p className="mt-3 text-base sm:text-lg text-[#0284C7] font-medium">
                  di {kelurahan} dan sekitarnya
                </p>
                <p className="mt-6 max-w-xl text-lg sm:text-xl text-[#334155] leading-relaxed">
                  {tagline}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  {waOrder && (
                    <a
                      href={waOrder}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cta-primary inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold"
                    >
                      <Icon name="whatsapp" size={18} />
                      Pesan sekarang
                    </a>
                  )}
                  {waAsk && (
                    <a
                      href={waAsk}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cta-ghost inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold"
                    >
                      <Icon name="messageCircle" size={18} />
                      Tanya dulu
                    </a>
                  )}
                  {primaryBranch?.slug && (
                    <a
                      href={`${SITE_URL}/pickup/${primaryBranch.slug}`}
                      className="cta-ghost inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold"
                    >
                      <Icon name="truck" size={18} />
                      Ajuan Pickup
                    </a>
                  )}
                  <a
                    href={`${SITE_URL}/track`}
                    className="inline-flex items-center gap-2 text-base font-semibold text-[#075985] hover:text-[#0284C7] transition-colors px-2 py-3.5"
                  >
                    Lacak pesanan
                    <span aria-hidden>→</span>
                  </a>
                </div>

                {/* Open status + address */}
                {primaryBranch?.address && (
                  <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                      style={
                        openStatus.open
                          ? { background: "#DCFCE7", color: "#166534" }
                          : { background: "#F1F5F9", color: "#475569" }
                      }
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: openStatus.open ? "#16A34A" : "#94A3B8" }}
                      />
                      {openStatus.label}
                    </span>
                    <span className="text-[#64748B]">{primaryBranch.address}</span>
                  </div>
                )}
              </div>

              {/* Hero visual */}
              <div className="md:col-span-5">
                <div className="relative aspect-[4/5] sm:aspect-[5/4] md:aspect-[4/5] rounded-3xl overflow-hidden border border-white/20 shadow-lg">
                  {settings.heroPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={settings.heroPhotoUrl}
                      alt={`${tenant.name} — laundry di ${kelurahan}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      width={800}
                      height={1000}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col justify-between p-8 sm:p-10">
                      <div className="eyebrow">
                        <Icon name="mapPin" size={14} />
                        {kelurahan}
                      </div>
                      <div>
                        <div
                          aria-hidden
                          className="font-display font-extrabold leading-none text-[#075985]"
                          style={{ fontSize: "clamp(3rem, 8vw, 6rem)", opacity: 0.85 }}
                        >
                          100%
                        </div>
                        <div className="mt-2 font-display text-xl sm:text-2xl font-bold text-[#0F172A]">
                          Bersih, wangi, rapi
                        </div>
                        <div className="mt-1 text-sm text-[#334155]">
                          Garansi hasil atau dicuci ulang.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Trust bar */}
            {trustStats.length > 0 && (
              <dl className="reveal mt-14 sm:mt-16 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E2E8F0] border-y border-[#E2E8F0]">
                {trustStats.map((s) => (
                  <div key={s.label} className="py-5 sm:px-6 first:sm:pl-0 last:sm:pr-0 flex sm:block items-baseline justify-between gap-4">
                    <dt className="eyebrow">
                      <Icon name="star" size={14} />
                      {s.label}
                    </dt>
                    <dd className="font-display font-bold text-xl sm:text-2xl text-[#0F172A] mt-0 sm:mt-2">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </header>

        {/* ─── Process (NEW) ─── */}
        <section
          id="proses"
          aria-labelledby="proses-h2"
          className="border-b border-[#E2E8F0] py-20 sm:py-24 bg-[#EFF6FF] scroll-mt-20"
        >
          <div className="mx-auto max-w-6xl px-6 sm:px-10">
            <div className="reveal max-w-2xl">
              <div className="eyebrow" style={{ color: "#7C3AED" }}>
                <Icon name="listChecks" size={14} />
                Proses
              </div>
              <h2
                id="proses-h2"
                className="font-display mt-4 font-extrabold tracking-tight text-[#0F172A]"
                style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
              >
                Empat langkah, <span style={{ color: "#7C3AED" }}>cucian selesai.</span>
              </h2>
              <p className="mt-4 text-lg text-[#334155] leading-relaxed">
                Dari pesan ke terima, semua simpel. Pickup gratis, kurir kabar, cuci rapi.
              </p>
            </div>

            <div className="relative mt-12 process-line">
              <ol className="grid grid-cols-1 sm:grid-cols-4 gap-6 sm:gap-4 relative z-10">
                {processSteps.map((step, i) => (
                  <li key={step.title} className="reveal flex sm:flex-col items-start sm:items-center gap-4 sm:gap-0 sm:text-center">
                    <div
                      className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-white bg-white shadow-sm"
                      style={{ color: "#7C3AED" }}
                    >
                      <Icon name={step.icon} size={24} />
                      <span
                        aria-hidden
                        className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: "#7C3AED" }}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <div className="sm:mt-4">
                      <div className="font-display font-bold text-base text-[#0F172A]">{step.title}</div>
                      <p className="mt-1 text-sm text-[#334155] leading-relaxed">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ─── Services ─── */}
        {services.length > 0 && (
          <section
            id="layanan"
            aria-labelledby="layanan-h2"
            className="border-b border-[#E2E8F0] py-20 sm:py-28 scroll-mt-20"
          >
            <div className="mx-auto max-w-6xl px-6 sm:px-10">
              <div className="reveal max-w-2xl">
                <div className="eyebrow">
                  <Icon name="drop" size={14} />
                  Layanan
                </div>
                <h2
                  id="layanan-h2"
                  className="font-display mt-4 font-extrabold tracking-tight text-[#0F172A]"
                  style={{ fontSize: "clamp(1.875rem, 4vw, 3rem)" }}
                >
                  Pilih layanan, <span style={{ color: "var(--brand)" }}>lihat harganya.</span>
                </h2>
                <p className="mt-4 text-lg text-[#334155] leading-relaxed">
                  Bayar sesuai pas — tidak ada biaya tersembunyi di kasir.
                </p>
              </div>

              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {services.map((svc) => {
                  const icon = serviceIcon(svc.name);
                  return (
                    <article
                      key={svc.name}
                      className="service-card reveal bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden flex flex-col"
                    >
                      <div className="flex items-center justify-between px-5 pt-5 pb-3 bg-[#F0F9FF]">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-xl"
                          style={{ background: "#fff", color: "#0284C7" }}
                        >
                          <Icon name={icon} size={24} />
                        </div>
                        <div className="text-right">
                          <div className="font-display font-extrabold text-xl text-[#0284C7] tabular-nums">
                            {formatPrice(Number(svc.basePrice))}
                          </div>
                          <div className="text-xs text-[#64748B] mt-0.5">
                            {pricingLabel(svc.pricingType)}
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 px-5 py-4">
                        <h3 className="font-display font-bold text-base text-[#0F172A]">{svc.name}</h3>
                        {svc.description && (
                          <p className="mt-1 text-sm text-[#334155] leading-relaxed">{svc.description}</p>
                        )}
                      </div>
                      {waOrder && (
                        <a
                          href={waOrder}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cta-primary flex items-center justify-center gap-2 py-3 text-sm font-semibold"
                        >
                          <Icon name="whatsapp" size={16} />
                          Pesan
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ─── Why-Us (NEW) ─── */}
        <section
          aria-labelledby="why-h2"
          className="border-b border-[#E2E8F0] py-20 sm:py-28 bg-[#EFF6FF]"
        >
          <div className="mx-auto max-w-6xl px-6 sm:px-10">
            <div className="reveal max-w-2xl">
              <div className="eyebrow" style={{ color: "#059669" }}>
                <Icon name="shieldCheck" size={14} />
                Keunggulan
              </div>
              <h2
                id="why-h2"
                className="font-display mt-4 font-extrabold tracking-tight text-[#0F172A]"
                style={{ fontSize: "clamp(1.875rem, 4vw, 3rem)" }}
              >
                Kenapa <span style={{ color: "#059669" }}>memilih kami?</span>
              </h2>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {whyUsCards.map((card, i) => (
                <div
                  key={`${card.title}-${i}`}
                  className="reveal bg-white rounded-2xl border border-[#E2E8F0] p-6 flex items-start gap-4"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "#ECFDF5", color: "#059669" }}
                  >
                    <Icon name={card.icon} size={22} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-[#0F172A]">{card.title}</h3>
                    <p className="mt-1 text-sm text-[#334155] leading-relaxed">{card.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Testimonials (NEW, hidden if empty) ─── */}
        {testimonials.length > 0 && (
          <section
            aria-labelledby="testi-h2"
            className="border-b border-[#E2E8F0] py-20 sm:py-28 bg-[#EFF6FF]"
          >
            <div className="mx-auto max-w-6xl px-6 sm:px-10">
              <div className="reveal max-w-2xl">
                <div className="eyebrow" style={{ color: "#D97706" }}>
                  <Icon name="quote" size={14} />
                  04 — Kata pelanggan
                </div>
                <h2
                  id="testi-h2"
                  className="font-display mt-4 font-extrabold tracking-tight text-[#0F172A]"
                  style={{ fontSize: "clamp(1.875rem, 4vw, 3rem)" }}
                >
                  Yang mereka <span style={{ color: "#D97706" }}>katakan.</span>
                </h2>
              </div>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {testimonials.map((t, i) => (
                  <figure
                    key={`${t.name}-${i}`}
                    className="reveal bg-white rounded-2xl border border-[#E2E8F0] p-6 flex flex-col gap-4"
                  >
                    {t.rating && <Stars rating={t.rating} />}
                    <blockquote className="text-[#334155] leading-relaxed text-base flex-1">
                      &ldquo;{t.text}&rdquo;
                    </blockquote>
                    <figcaption>
                      <div className="font-display font-bold text-sm text-[#0F172A]">{t.name}</div>
                      {t.role && <div className="text-xs text-[#64748B] mt-0.5">{t.role}</div>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ─── About ─── */}
        <section
          aria-labelledby="about-h2"
          className="border-b border-[#E2E8F0] py-20 sm:py-28"
        >
          <div className="mx-auto max-w-3xl px-6 sm:px-10">
            <div className="reveal">
              <div className="eyebrow">
                <Icon name="info" size={14} />
                05 — Tentang
              </div>
              <h2
                id="about-h2"
                className="font-display mt-4 font-extrabold tracking-tight text-[#0F172A]"
                style={{ fontSize: "clamp(1.875rem, 4vw, 3rem)" }}
              >
                Cerita kami.
              </h2>
              <p className="mt-6 text-lg sm:text-xl text-[#334155] leading-relaxed">
                {about}
              </p>
              {settings.areaServed && settings.areaServed.length > 0 && (
                <div className="mt-8">
                  <div className="eyebrow" style={{ color: "#64748B" }}>Area kami melayani</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {settings.areaServed.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] text-[#075985] px-3 py-1 text-xs font-medium"
                      >
                        <Icon name="mapPin" size={12} />
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Hours + Map ─── */}
        {(hours.length > 0 || primaryBranch?.googleMapsLink || mapEmbedUrl) && (
          <section
            id="lokasi"
            aria-labelledby="lokasi-h2"
            className="border-b border-[#E2E8F0] py-20 sm:py-28 bg-[#F8FBFF] scroll-mt-20"
          >
            <div className="mx-auto max-w-6xl px-6 sm:px-10">
              <div className="reveal max-w-2xl">
                <div className="eyebrow" style={{ color: "#075985" }}>
                  <Icon name="mapPin" size={14} />
                  06 — Kunjungi
                </div>
                <h2
                  id="lokasi-h2"
                  className="font-display mt-4 font-extrabold tracking-tight text-[#0F172A]"
                  style={{ fontSize: "clamp(1.875rem, 4vw, 3rem)" }}
                >
                  Temukan <span style={{ color: "var(--brand)" }}>kami.</span>
                </h2>
              </div>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                {hours.length > 0 && (
                  <div className="reveal bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="eyebrow">
                        <Icon name="clock" size={14} />
                        Jam Operasional
                      </div>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={
                          openStatus.open
                            ? { background: "#DCFCE7", color: "#166534" }
                            : { background: "#F1F5F9", color: "#475569" }
                        }
                      >
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: openStatus.open ? "#16A34A" : "#94A3B8" }}
                        />
                        {openStatus.open ? "Buka sekarang" : "Tutup"}
                      </span>
                    </div>
                    <ul className="divide-y divide-[#F1F5F9]">
                      {hours.map((h) => {
                        const dayKeys = ["min", "mon", "tue", "wed", "thu", "fri", "sat"];
                        const isToday = h.dayKey === dayKeys[new Date().getDay()];
                        return (
                          <li
                            key={h.day}
                            className={`flex justify-between py-3 ${isToday ? "font-semibold" : ""}`}
                          >
                            <span className={`text-sm ${isToday ? "text-[#0284C7]" : "text-[#334155]"}`}>
                              {h.day}
                              {isToday && <span className="ml-2 text-[11px] uppercase tracking-wide text-[#0284C7]">Hari ini</span>}
                            </span>
                            <span className={`font-mono-label text-sm ${isToday ? "text-[#0F172A]" : "text-[#334155]"}`}>
                              {h.time}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="reveal bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8 flex flex-col gap-4">
                  <div>
                    <div className="eyebrow">
                      <Icon name="mapPin" size={14} />
                      Alamat
                    </div>
                    {primaryBranch?.address && (
                      <p className="mt-2 text-base text-[#334155] leading-relaxed">
                        {primaryBranch.address}
                      </p>
                    )}
                    {primaryBranch?.phone && (
                      <a
                        href={`tel:${primaryBranch.phone}`}
                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#0284C7] hover:text-[#075985]"
                      >
                        <Icon name="phone" size={16} />
                        {primaryBranch.phone}
                      </a>
                    )}
                  </div>
                  {mapEmbedUrl && (
                    <div className="relative rounded-xl overflow-hidden border border-[#E2E8F0] mt-2">
                      <iframe
                        src={mapEmbedUrl}
                        title={`Lokasi ${tenant.name}`}
                        width="100%"
                        height="220"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        style={{ border: 0, display: "block" }}
                      />
                    </div>
                  )}
                  {primaryBranch?.googleMapsLink && !mapEmbedUrl && (
                    <a
                      href={primaryBranch.googleMapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cta-primary inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold mt-2"
                    >
                      Buka di Google Maps →
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── FAQ (NEW) ─── */}
        <section
          id="faq"
          aria-labelledby="faq-h2"
          className="border-b border-[#E2E8F0] py-20 sm:py-28 scroll-mt-20"
        >
          <div className="mx-auto max-w-3xl px-6 sm:px-10">
            <div className="reveal">
              <div className="eyebrow" style={{ color: "#7C3AED" }}>
                <Icon name="helpCircle" size={14} />
                07 — FAQ
              </div>
              <h2
                id="faq-h2"
                className="font-display mt-4 font-extrabold tracking-tight text-[#0F172A]"
                style={{ fontSize: "clamp(1.875rem, 4vw, 3rem)" }}
              >
                Pertanyaan <span style={{ color: "#7C3AED" }}>umum.</span>
              </h2>
              <p className="mt-4 text-lg text-[#334155] leading-relaxed">
                Belum nemu jawabannya? Chat WhatsApp, kami balas cepat.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {faqs.map((f, i) => (
                <details
                  key={`${f.question}-${i}`}
                  className="reveal group bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
                  open={i === 0}
                >
                  <summary className="flex items-center justify-between gap-4 p-5 sm:p-6">
                    <span className="font-display font-bold text-base text-[#0F172A]">{f.question}</span>
                    <span aria-hidden className="faq-chevron text-[#0284C7] shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-[#334155] leading-relaxed">
                    {f.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Payment (NEW) ─── */}
        <section
          aria-labelledby="pay-h2"
          className="border-b border-[#E2E8F0] py-20 sm:py-24 bg-[#EFF6FF]"
        >
          <div className="mx-auto max-w-6xl px-6 sm:px-10">
            <div className="reveal grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="eyebrow">
                  <Icon name="qrCode" size={14} />
                  08 — Pembayaran
                </div>
                <h2
                  id="pay-h2"
                  className="font-display mt-4 font-extrabold tracking-tight text-[#0F172A]"
                  style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
                >
                  Bayar <span style={{ color: "var(--brand)" }}>cara apa pun.</span>
                </h2>
                <p className="mt-4 text-lg text-[#334155] leading-relaxed">
                  Tunai, transfer, QRIS, atau e-wallet. Pembayaran saat ambil atau saat diantar.
                </p>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {["Tunai", "Transfer", "QRIS", "OVO", "GoPay", "DANA"].map((m) => (
                    <li
                      key={m}
                      className="inline-flex items-center rounded-full bg-white border border-[#E2E8F0] px-3 py-1.5 text-sm font-semibold text-[#334155]"
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
              {settings.qrisImageUrl && (
                <div className="reveal flex justify-center md:justify-end">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.qrisImageUrl}
                    alt="QRIS — scan untuk bayar"
                    width={240}
                    height={240}
                    loading="lazy"
                    className="rounded-2xl bg-white border border-[#E2E8F0] p-3 shadow-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Contact ─── */}
        <section
          aria-labelledby="kontak-h2"
          className="border-b border-[#E2E8F0] py-20 sm:py-28"
        >
          <div className="mx-auto max-w-6xl px-6 sm:px-10">
            <div className="reveal max-w-2xl">
              <div className="eyebrow">
                <Icon name="phone" size={14} />
                09 — Kontak
              </div>
              <h2
                id="kontak-h2"
                className="font-display mt-4 font-extrabold tracking-tight text-[#0F172A]"
                style={{ fontSize: "clamp(1.875rem, 4vw, 3rem)" }}
              >
                Siap melayani.
              </h2>
              <p className="mt-4 text-lg text-[#334155] leading-relaxed">
                Mau pesan atau tanya? Dua tombol di bawah, pilih sesuai niat Anda.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {waOrder && (
                <a
                  href={waOrder}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="reveal group bg-white rounded-2xl border border-[#E2E8F0] p-6 flex flex-col gap-3 hover:border-[#25D366] hover:shadow-sm transition-all"
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: "#DCFCE7", color: "#166534" }}
                  >
                    <Icon name="whatsapp" size={22} />
                  </div>
                  <div className="eyebrow">Pesan</div>
                  <div className="font-display font-bold text-lg text-[#0F172A] group-hover:text-[#166534] transition-colors">
                    Chat pesanan →
                  </div>
                  <p className="text-sm text-[#64748B]">Langsung absen cucian Anda.</p>
                </a>
              )}
              {waAsk && (
                <a
                  href={waAsk}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="reveal group bg-white rounded-2xl border border-[#E2E8F0] p-6 flex flex-col gap-3 hover:border-[#BAE6FD] hover:shadow-sm transition-all"
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: "#EFF6FF", color: "#0284C7" }}
                  >
                    <Icon name="messageCircle" size={22} />
                  </div>
                  <div className="eyebrow">Tanya</div>
                  <div className="font-display font-bold text-lg text-[#0F172A] group-hover:text-[#075985] transition-colors">
                    Tanya via WhatsApp →
                  </div>
                  <p className="text-sm text-[#64748B]">Estimasi harga, area, layanan.</p>
                </a>
              )}
              {primaryBranch?.phone && (
                <a
                  href={`tel:${primaryBranch.phone}`}
                  className="reveal group bg-white rounded-2xl border border-[#E2E8F0] p-6 flex flex-col gap-3 hover:border-[#BAE6FD] hover:shadow-sm transition-all"
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: "#EFF6FF", color: "#0284C7" }}
                  >
                    <Icon name="phone" size={22} />
                  </div>
                  <div className="eyebrow">Telepon</div>
                  <div className="font-display font-bold text-lg text-[#0F172A] group-hover:text-[#075985] transition-colors break-all">
                    {primaryBranch.phone} →
                  </div>
                  <p className="text-sm text-[#64748B]">Untuk pertanyaan langsung.</p>
                </a>
              )}
              {settings.instagram && (
                <a
                  href={settings.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="reveal group bg-white rounded-2xl border border-[#E2E8F0] p-6 flex flex-col gap-3 hover:border-[#BAE6FD] hover:shadow-sm transition-all"
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: "#EFF6FF", color: "#0284C7" }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="2" y="2" width="20" height="20" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                    </svg>
                  </div>
                  <div className="eyebrow">Instagram</div>
                  <div className="font-display font-bold text-lg text-[#0F172A] group-hover:text-[#075985] transition-colors break-all">
                    Portofolio →
                  </div>
                  <p className="text-sm text-[#64748B]">Cari referensi kerja kami.</p>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ─── CTA banner (NEW) ─── */}
        {waOrder && (
          <section className="border-b border-[#E2E8F0]">
            <div className="cta-banner">
              <div className="mx-auto max-w-6xl px-6 sm:px-10 py-14 sm:py-16 text-center">
                <h2
                  className="font-display font-extrabold tracking-tight"
                  style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
                >
                  Cucian menumpak? Biar kami urus.
                </h2>
                <p className="mt-3 text-base sm:text-lg opacity-90 max-w-xl mx-auto">
                  Pickup gratis di {kelurahan} hari ini. Pesan sekarang, selesai dalam 3 jam.
                </p>
                <a
                  href={waOrder}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-[#075985] hover:bg-[#F0F9FF] transition-colors"
                >
                  <Icon name="whatsapp" size={18} />
                  Pesan via WhatsApp
                </a>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ─── Footer ─── */}
      <footer className="py-10 bg-white">
        <div className="mx-auto max-w-6xl px-6 sm:px-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-[#64748B]">
            © {new Date().getFullYear()} {tenant.name}
          </p>
          <a
            href={SITE_URL}
            className="text-xs font-medium text-[#64748B] hover:text-[#0284C7] transition-colors"
          >
            Dibuat dengan hivePOS
          </a>
        </div>
      </footer>

      {/* Floating WhatsApp — opens order intent */}
      {waOrder && (
        <a
          href={waOrder}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Pesan via WhatsApp"
          className="floating-wa inline-flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "#25D366", color: "#fff" }}
        >
          <Icon name="whatsapp" size={28} />
        </a>
      )}

      {/* Sticky mobile CTA bar — always-visible "Pesan via WhatsApp" on phones */}
      {waOrder && (
        <div className="mobile-cta-bar">
          <a
            href={waOrder}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-primary flex items-center justify-center gap-2 rounded-full py-3.5 text-center text-sm font-bold"
          >
            <Icon name="whatsapp" size={18} />
            Pesan via WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
