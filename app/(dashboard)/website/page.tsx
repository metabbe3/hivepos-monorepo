"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Globe, ExternalLink, AlertCircle, Sparkles, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/modules/shared";

// ponytail: thin client for the website settings API. Plan gate lives server-side;
// here we just show a CTA if plan !== 'PRO'. Phase 2 adds trust signals, FAQ,
// testimonials — repeatable lists use plain useState arrays, no drag-drop (YAGNI).

interface FaqRow { question: string; answer: string; }
interface TestimonialRow { name: string; role: string; text: string; rating: string; }

interface WebsiteData {
  plan: "FREE" | "GROWTH" | "PRO";
  slug: string;
  websiteEnabled: boolean;
  websitePublishedAt: string | null;
  subdomain: string;
  settings: {
    tagline?: string;
    heroPhotoUrl?: string;
    about?: string;
    instagram?: string;
    qrisImageUrl?: string;
    googleRating?: number;
    googleReviewCount?: number;
    yearEstablished?: number;
    avgProcessingMinutes?: number;
    areaServed?: string[];
    faqs?: FaqRow[];
    testimonials?: TestimonialRow[];
  };
}

export default function WebsiteSettingsPage() {
  const confirm = useConfirm();
  const [data, setData] = useState<WebsiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  // ponytail: Phase 1 fields.
  const [tagline, setTagline] = useState("");
  const [heroPhotoUrl, setHeroPhotoUrl] = useState("");
  const [about, setAbout] = useState("");
  const [instagram, setInstagram] = useState("");
  const [qrisImageUrl, setQrisImageUrl] = useState("");

  // ponytail: Phase 2 — trust signals.
  const [googleRating, setGoogleRating] = useState("");
  const [googleReviewCount, setGoogleReviewCount] = useState("");
  const [yearEstablished, setYearEstablished] = useState("");
  const [avgProcessingMinutes, setAvgProcessingMinutes] = useState("");
  const [areaServed, setAreaServed] = useState("");

  // ponytail: Phase 2 — repeatable lists.
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialRow[]>([]);

  useEffect(() => {
    apiFetch<WebsiteData>("/api/tenant/website")
      .then((r) => {
        setData(r.data);
        const s = r.data.settings ?? {};
        setTagline(s.tagline ?? "");
        setHeroPhotoUrl(s.heroPhotoUrl ?? "");
        setAbout(s.about ?? "");
        setInstagram(s.instagram ?? "");
        setQrisImageUrl(s.qrisImageUrl ?? "");
        setGoogleRating(s.googleRating?.toString() ?? "");
        setGoogleReviewCount(s.googleReviewCount?.toString() ?? "");
        setYearEstablished(s.yearEstablished?.toString() ?? "");
        setAvgProcessingMinutes(s.avgProcessingMinutes?.toString() ?? "");
        setAreaServed((s.areaServed ?? []).join(", "));
        setFaqs(s.faqs && s.faqs.length > 0 ? s.faqs : []);
        setTestimonials(s.testimonials && s.testimonials.length > 0 ? s.testimonials : []);
      })
      .catch((err) => {
        if (err instanceof ApiClientError) toast.error(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // ponytail: repeatable list mutators — append blank row, remove by index.
  function addFaq() {
    setFaqs((prev) => [...prev, { question: "", answer: "" }]);
  }
  function updateFaq(i: number, field: keyof FaqRow, value: string) {
    setFaqs((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }
  function removeFaq(i: number) {
    setFaqs((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addTestimonial() {
    setTestimonials((prev) => [...prev, { name: "", role: "", text: "", rating: "" }]);
  }
  function updateTestimonial(i: number, field: keyof TestimonialRow, value: string) {
    setTestimonials((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }
  function removeTestimonial(i: number) {
    setTestimonials((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    try {
      // ponytail: filter empty repeatable rows + convert numeric strings.
      const cleanedFaqs = faqs
        .filter((f) => f.question.trim() && f.answer.trim())
        .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }));
      const cleanedTestimonials = testimonials
        .filter((t) => t.name.trim() && t.text.trim())
        .map((t) => ({
          name: t.name.trim(),
          role: t.role.trim() || undefined,
          text: t.text.trim(),
          rating: t.rating ? Number(t.rating) : undefined,
        }));
      const cleanedAreaServed = areaServed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {
        tagline: tagline || undefined,
        heroPhotoUrl: heroPhotoUrl || "",
        about: about || undefined,
        instagram: instagram || "",
        qrisImageUrl: qrisImageUrl || "",
        googleRating: googleRating ? Number(googleRating) : undefined,
        googleReviewCount: googleReviewCount ? Number(googleReviewCount) : undefined,
        yearEstablished: yearEstablished ? Number(yearEstablished) : undefined,
        avgProcessingMinutes: avgProcessingMinutes ? Number(avgProcessingMinutes) : undefined,
        areaServed: cleanedAreaServed.length > 0 ? cleanedAreaServed : undefined,
        faqs: cleanedFaqs.length > 0 ? cleanedFaqs : undefined,
        testimonials: cleanedTestimonials.length > 0 ? cleanedTestimonials : undefined,
      };

      const r = await apiFetch<WebsiteData>("/api/tenant/website", {
        method: "PATCH",
        body: payload,
      });
      setData(r.data);
      toast.success("Website berhasil diperbarui.");
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpublish() {
    if (!(await confirm({
      title: "Nonaktifkan website?",
      description: "Website akan dinonaktifkan. Pengunjung akan melihat halaman 'tidak tersedia'. Lanjutkan?",
      destructive: true,
    }))) return;
    setUnpublishing(true);
    try {
      const r = await apiFetch<WebsiteData>("/api/tenant/website", { method: "DELETE" });
      setData(r.data);
      toast.success("Website dinonaktifkan.");
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally {
      setUnpublishing(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPro = data.plan === "PRO";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Website Laundry"
        description="Website laundry Anda sendiri dengan SEO lokal. Otomatis terisi dari data outlet."
      />

      {/* Status banner */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{data.subdomain}</span>
                  <Badge variant={data.websiteEnabled ? "default" : "secondary"}>
                    {data.websiteEnabled ? "Live" : "Nonaktif"}
                  </Badge>
                  <Badge variant="outline">{data.plan}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.websiteEnabled && data.websitePublishedAt
                    ? `Live sejak ${new Date(data.websitePublishedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
                    : "Website belum dipublikasikan."}
                </p>
              </div>
            </div>
            {data.websiteEnabled && (
              <a
                href={`https://${data.subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
              >
                Lihat Website
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {!isPro && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                  Website sendiri tersedia di paket Pro
                </h3>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                  Upgrade ke Pro (Rp 79K/outlet/bulan) untuk mengaktifkan website
                  laundry Anda di <strong>{data.subdomain}</strong> dengan SEO
                  lokal, tombol WhatsApp, dan track pesanan online.
                </p>
                <Link
                  href="/billing"
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Upgrade ke Pro
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isPro && (
        <form onSubmit={handleSave} className="space-y-4">
          {/* Content card */}
          <Card>
            <CardHeader>
              <CardTitle>Konten Website</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                label="Tagline"
                hint="Satu kalimat value prop. Kosongkan untuk default: 'Laundry kiloan selesai 3 jam di [kelurahan]. Garansi bersih atau dicuci ulang.'"
              >
                <Input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Laundry kiloan selesai 3 jam di kelurahan Anda. Garansi bersih atau dicuci ulang."
                  maxLength={160}
                />
              </FormField>

              <FormField
                label="URL Foto Hero"
                hint="URL gambar untuk background hero section. Kosongkan untuk foto default."
              >
                <Input
                  value={heroPhotoUrl}
                  onChange={(e) => setHeroPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </FormField>

              <FormField
                label="Tentang Kami"
                hint="2-3 kalimat tentang laundry Anda. Kosongkan untuk auto-generate dari alamat."
              >
                <Textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  rows={4}
                  maxLength={800}
                  placeholder="Laundry di kelurahan Anda sejak tahun..."
                />
              </FormField>

              <FormField
                label="URL Instagram"
                hint="Link akun Instagram laundry Anda. Kosongkan untuk menyembunyikan."
              >
                <Input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="https://instagram.com/..."
                  type="url"
                />
              </FormField>

              <FormField
                label="URL Gambar QRIS"
                hint="Tampil di halaman tracking pesanan dan section pembayaran. Kosongkan untuk menyembunyikan."
              >
                <Input
                  value={qrisImageUrl}
                  onChange={(e) => setQrisImageUrl(e.target.value)}
                  placeholder="https://...qris.jpg"
                  type="url"
                />
              </FormField>
            </CardContent>
          </Card>

          {/* Trust signals card */}
          <Card>
            <CardHeader>
              <CardTitle>Sinyal Kepercayaan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Data ini menampilkan badge kepercayaan di hero section dan membantu SEO lokal.
                Kosongkan jika belum ada — badge disembunyikan otomatis.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Rating Google"
                  hint="0 - 5, boleh desimal (contoh: 4.8)"
                >
                  <Input
                    value={googleRating}
                    onChange={(e) => setGoogleRating(e.target.value)}
                    placeholder="4.8"
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                  />
                </FormField>

                <FormField
                  label="Jumlah Ulasan Google"
                  hint="Total ulanan Google (contoh: 127)"
                >
                  <Input
                    value={googleReviewCount}
                    onChange={(e) => setGoogleReviewCount(e.target.value)}
                    placeholder="127"
                    type="number"
                    min={0}
                    step={1}
                  />
                </FormField>

                <FormField
                  label="Tahun Berdiri"
                  hint="Tahun laundry mulai beroperasi."
                >
                  <Input
                    value={yearEstablished}
                    onChange={(e) => setYearEstablished(e.target.value)}
                    placeholder="2020"
                    type="number"
                    min={1900}
                    max={new Date().getFullYear()}
                    step={1}
                  />
                </FormField>

                <FormField
                  label="Rata-rata Waktu Proses (menit)"
                  hint="Contoh: 180 untuk 3 jam. Tampil di hero section."
                >
                  <Input
                    value={avgProcessingMinutes}
                    onChange={(e) => setAvgProcessingMinutes(e.target.value)}
                    placeholder="180"
                    type="number"
                    min={0}
                    step={1}
                  />
                </FormField>
              </div>

              <FormField
                label="Area Layanan"
                hint="Pisahkan dengan koma. Contoh: Kelurahan A, Kelurahan B, Kelurahan C. Maks 20 area."
              >
                <Input
                  value={areaServed}
                  onChange={(e) => setAreaServed(e.target.value)}
                  placeholder="Kelurahan Sukabumi, Kelurahan Utan, Kelurahan Pasar"
                />
              </FormField>
            </CardContent>
          </Card>

          {/* FAQ card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>FAQ</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pertanyaan yang sering ditanyakan. Tampil sebagai accordion di website + FAQ rich result di Google.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addFaq}>
                  <Plus className="mr-1.5 h-4 w-4" /> Tambah FAQ
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {faqs.length === 0 ? (
                <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  Belum ada FAQ. Jika kosong, 4 FAQ default laundry akan tampil otomatis.
                </p>
              ) : (
                faqs.map((faq, i) => (
                  <div key={i} className="space-y-2 rounded-lg border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">
                        FAQ #{i + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFaq(i)}
                        className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Hapus
                      </Button>
                    </div>
                    <Input
                      value={faq.question}
                      onChange={(e) => updateFaq(i, "question", e.target.value)}
                      placeholder="Pertanyaan (contoh: Berapa lama proses cuci kiloan?)"
                      maxLength={200}
                    />
                    <Textarea
                      value={faq.answer}
                      onChange={(e) => updateFaq(i, "answer", e.target.value)}
                      placeholder="Jawaban (contoh: Reguler 1 hari, express 3 jam.)"
                      rows={2}
                      maxLength={1000}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Testimonials card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Testimoni Pelanggan</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ulasan asli pelanggan. Tampil di section &quot;Kata Pelanggan&quot; + Review rich result di Google.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addTestimonial}>
                  <Plus className="mr-1.5 h-4 w-4" /> Tambah Testimoni
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {testimonials.length === 0 ? (
                <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  Belum ada testimoni. Section ini disembunyikan sampai ada minimal 1 testimoni.
                </p>
              ) : (
                testimonials.map((t, i) => (
                  <div key={i} className="space-y-2 rounded-lg border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">
                        Testimoni #{i + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTestimonial(i)}
                        className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Hapus
                      </Button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        value={t.name}
                        onChange={(e) => updateTestimonial(i, "name", e.target.value)}
                        placeholder="Nama pelanggan (wajib)"
                        maxLength={100}
                      />
                      <Input
                        value={t.role}
                        onChange={(e) => updateTestimonial(i, "role", e.target.value)}
                        placeholder="Keterangan (contoh: Pelanggan sejak 2022)"
                        maxLength={200}
                      />
                    </div>
                    <Textarea
                      value={t.text}
                      onChange={(e) => updateTestimonial(i, "text", e.target.value)}
                      placeholder="Isi testimoni (wajib)"
                      rows={2}
                      maxLength={500}
                    />
                    <div className="grid gap-2 md:grid-cols-4">
                      <FormField label="Rating (1-5)">
                        <Input
                          value={t.rating}
                          onChange={(e) => updateTestimonial(i, "rating", e.target.value)}
                          placeholder="5"
                          type="number"
                          min={1}
                          max={5}
                          step={1}
                        />
                      </FormField>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan & Publikasikan"
                )}
              </Button>
              {data.websiteEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUnpublish}
                  disabled={unpublishing}
                >
                  {unpublishing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menonaktifkan...
                    </>
                  ) : (
                    "Nonaktifkan Website"
                  )}
                </Button>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              Perubahan live dalam ~60 detik (cache TTL).
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
