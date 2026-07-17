"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LifeBuoy,
  MessageSquare,
  Rocket,
  CreditCard,
  Wrench,
  Users,
  HelpCircle,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoading } from "@/components/shared/loading";
import { CardListItem } from "@/components/shared/card-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useCrudResource } from "@/hooks/use-crud-resource";
import { useTranslation } from "@/hooks/use-translation";
import { StatusBadge, PriorityBadge } from "@/components/tickets/ticket-status-badge";

// ponytail: unified Bantuan hub. Left = ticket list, right = FAQ accordion +
// contact card. FAQ content is bilingual via t(); fallback to id strings.
// /help page is gone — everything lives here now.

interface TicketListItem {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  csatRating: number | null;
  commentCount: number;
}

interface Faq {
  q: string;
  a: string;
}
interface FaqSection {
  id: string;
  titleKey: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Faq[];
}

const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "memulai",
    titleKey: "faq.memulai",
    icon: Rocket,
    items: [
      {
        q: "Bagaimana cara menambah pelanggan pertama saya?",
        a: "Buka halaman Pelanggan di sidebar dan klik Tambah Pelanggan. Anda hanya perlu nama — nomor HP dan email opsional tapi disarankan untuk pengingat.",
      },
      {
        q: "Bagaimana cara membuat pesanan pertama?",
        a: "Masuk ke Orders → Pesanan Baru. Pilih pelanggan, tambah layanan, atur berat/jumlah, lalu simpan. Nomor pesanan dibuat otomatis.",
      },
      {
        q: "Bagaimana cara mengatur layanan dan harga?",
        a: "Buka Layanan & Harga di sidebar. Klik Tambah Layanan, pilih tipe harga (per kg, per item, atau flat), lalu masukkan harga dasar.",
      },
    ],
  },
  {
    id: "penagihan",
    titleKey: "faq.penagihan",
    icon: CreditCard,
    items: [
      {
        q: "Bagaimana sistem penagihan bekerja?",
        a: "Anda ditagih per outlet. Outlet pertama gratis; outlet tambahan ditagih bulanan atau tahunan. Tanggal cakupan muncul di halaman Billing.",
      },
      {
        q: "Apa yang terjadi jika langganan saya berakhir?",
        a: "Outlet yang sudah lewat tanggal cakupan akan dikunci. Data tetap aman — cukup perpanjang untuk mendapatkan akses kembali.",
      },
      {
        q: "Bisakah saya minta pengembalian dana?",
        a: "Buat tiket di kategori Penagihan dengan detail pembayaran Anda. Tim kami akan meninjau dalam 1 hari kerja.",
      },
    ],
  },
  {
    id: "teknis",
    titleKey: "faq.teknis",
    icon: Wrench,
    items: [
      {
        q: "Mengapa halaman Orders tidak muncul?",
        a: "Orders terikat ke outlet tertentu. Pastikan Anda sudah memilih outlet di bilah atas (bukan Semua Outlet).",
      },
      {
        q: "Bagaimana cara mengganti password?",
        a: "Buka Profil → Ganti Password. Anda akan otomatis keluar dari perangkat lain setelah mengganti password.",
      },
      {
        q: "Mengapa laporan saya kosong?",
        a: "Laporan butuh pesanan dalam rentang tanggal yang dipilih. Coba perluas rentang atau pastikan pesanan dibuat di outlet yang dipilih.",
      },
    ],
  },
  {
    id: "akun",
    titleKey: "faq.akun",
    icon: Users,
    items: [
      {
        q: "Apa beda Owner, Manager, dan Employee?",
        a: "Owner punya akses penuh termasuk billing dan staff. Manager menjalankan operasional harian. Employee menangani pesanan dan pelanggan.",
      },
      {
        q: "Bagaimana cara menambah staff?",
        a: "Buka Staff → Tambah User. Berikan peran — izin mengikuti peran, bukan individu.",
      },
      {
        q: "Bisakah saya atur apa yang bisa dilakukan tiap peran?",
        a: "Ya — buka Roles, klik peran, lalu toggle izin per resource. Owner selalu punya akses wildcard.",
      },
    ],
  },
];

// ponytail: FAQ section title lookup. Inline map keeps the FAQ content
// language-consistent with the rest of the page without duplicating keys.
const SECTION_TITLES: Record<string, { en: string; id: string }> = {
  "faq.memulai": { en: "Getting Started", id: "Memulai" },
  "faq.penagihan": { en: "Billing & Subscription", id: "Penagihan & Langganan" },
  "faq.teknis": { en: "Technical", id: "Teknis" },
  "faq.akun": { en: "Account & Roles", id: "Akun & Peran" },
};

const FAQ_HEADING: Record<string, { en: string; id: string }> = {
  title: { en: "Frequently Asked Questions", id: "Pertanyaan Umum" },
};

export default function TicketsPage() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { items: tickets, loading } = useCrudResource<TicketListItem>({
    endpoint: "/api/tickets",
  });

  if (loading) return <PageLoading />;

  const sectionTitle = (key: string) =>
    (SECTION_TITLES[key] ?? { en: key, id: key })[lang];

  const faqHeading = FAQ_HEADING.title[lang];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("tickets.title")}
        description={t("tickets.description")}
        action={{
          label: t("tickets.new"),
          onClick: () => router.push("/tickets/new"),
        }}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: ticket list */}
        <div className="lg:col-span-2 space-y-3">
          {tickets.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title={t("tickets.noTickets")}
              description={t("tickets.noTicketsDesc")}
              action={{
                label: t("tickets.new"),
                onClick: () => router.push("/tickets/new"),
              }}
            />
          ) : (
            tickets.map((ticket) => (
              <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="block">
                <CardListItem interactive>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{ticket.subject}</p>
                          <StatusBadge status={ticket.status} />
                          <PriorityBadge priority={ticket.priority} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                          {ticket.description}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {new Date(ticket.createdAt).toLocaleDateString(
                              lang === "id" ? "id-ID" : "en-US",
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {ticket.commentCount}
                          </span>
                          {ticket.csatRating && (
                            <span className="text-amber-500">
                              {"★".repeat(ticket.csatRating)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </CardListItem>
              </Link>
            ))
          )}
        </div>

        {/* Right column: FAQ accordion + contact card */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="h-5 w-5 text-primary" />
                {faqHeading}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion multiple={false} defaultValue={["memulai"]}>
                {FAQ_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  return (
                    <AccordionItem key={section.id} value={section.id}>
                      <AccordionTrigger>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          {sectionTitle(section.titleKey)}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          {section.items.map((qa, i) => (
                            <div key={i} className="space-y-1">
                              <p className="text-sm font-medium text-foreground">
                                {qa.q}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {qa.a}
                              </p>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-5 space-y-3">
              <div>
                <p className="text-sm font-semibold">
                  {t("tickets.contactTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("tickets.contactDesc")}
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => router.push("/tickets/new")}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("tickets.createNew")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
