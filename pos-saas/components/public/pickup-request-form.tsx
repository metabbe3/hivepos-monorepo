"use client";

import { useMemo, useRef, useState } from "react";
import {
  MapPin,
  LocateFixed,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  MessageCircle,
} from "lucide-react";
import { DynamicForm } from "@/lib/forms/dynamic-form";
import { pickupPublicSchema } from "@/lib/forms/schemas";
import { renderWhatsAppTemplate, type TemplateOverrides } from "@/lib/whatsapp-templates";
import type { FormSchema, FieldDef } from "@/lib/forms/types";
import { appendWhatsappMessage } from "@/lib/whatsapp";

type SlotDay = { day?: string; slots?: string[] };

interface PickupRequestFormProps {
  branchSlug: string;
  branchName: string;
  branchAddress: string | null;
  /** Existing wa.me URL for the branch. Null = hide WhatsApp path, DB-only. */
  branchWhatsappLink: string | null;
  slotDays: SlotDay[];
  whatsappTemplates?: TemplateOverrides;
}

type Status = "idle" | "submitting" | "success" | "error" | "wa-opened";

/** Flatten all unique slots across all days for the picker. */
function flattenSlots(slotDays: SlotDay[]): string[] {
  const set = new Set<string>();
  for (const day of slotDays) {
    if (Array.isArray(day?.slots)) for (const s of day.slots) set.add(s);
  }
  return Array.from(set);
}

/** Generate the next N selectable dates (YYYY-MM-DD + label). */
function nextDates(count = 14): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      value: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }),
    });
  }
  return out;
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-slate-400 outline-none transition-all focus:border-brand/50 focus:ring-2 focus:ring-brand/20";

/**
 * Build the WA message body. Strips empty optional fields so the chat preview
 * stays compact. Lines use \n for wa.me encoding.
 */
function buildPickupMessage(
  values: Record<string, unknown>,
  branchName: string,
  overrides?: TemplateOverrides,
): string {
  const lines: string[] = [];
  const name = String(values.name ?? "").trim();
  const phone = String(values.phone ?? "").trim();
  const address = String(values.addressText ?? "").trim();
  const date = values.requestedDate as string | undefined;
  const slot = values.requestedSlot as string | undefined;
  const notes = String(values.notes ?? "").trim();

  if (name) lines.push(`Nama: ${name}`);
  if (phone) lines.push(`No. WhatsApp: ${phone}`);
  if (address) lines.push(`Alamat: ${address}`);
  if (date) {
    const dateLabel = new Date(date).toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    lines.push(`Tanggal: ${dateLabel}`);
  }
  if (slot) lines.push(`Slot: ${slot}`);
  if (notes) lines.push(`Catatan: ${notes}`);

  return renderWhatsAppTemplate(
    "pickup.request",
    { branchName, pickupDetails: lines.join("\n") },
    overrides,
  );
}

export function PickupRequestForm({
  branchSlug,
  branchName,
  branchAddress,
  branchWhatsappLink,
  slotDays,
  whatsappTemplates,
}: PickupRequestFormProps) {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "ok" | "denied" | "error">("idle");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [submittedName, setSubmittedName] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  // ponytail: React onSubmit doesn't pass native submitter info. Ref it here.
  const intentRef = useRef<"whatsapp" | "db">(branchWhatsappLink ? "whatsapp" : "db");

  const slots = useMemo(() => flattenSlots(slotDays), [slotDays]);
  const dates = useMemo(() => nextDates(14), []);
  const showWhatsApp = !!branchWhatsappLink;

  // Ponytail: schema assembled here (depends on slotDays/dates runtime data).
  // addressText uses custom render for GPS button combo, owned by DynamicForm state.
  const schema = useMemo<FormSchema>(() => {
    const addressField: FieldDef = {
      name: "addressText",
      label: "Lokasi Penjemputan",
      type: "textarea",
      placeholder: "Alamat lengkap / patokan (opsional jika GPS aktif)",
      colSpan: 2,
      render: ({ value, onChange }) => (
        <PickupAddressField
          value={String(value ?? "")}
          onChange={onChange}
          coords={coords}
          gpsStatus={gpsStatus}
          onGetLocation={handleGetLocation}
        />
      ),
    };
    return {
      ...pickupPublicSchema,
      fields: pickupPublicSchema.fields.map((f) => {
        if (f.name === "requestedDate") return { ...f, options: dates };
        if (f.name === "requestedSlot") return { ...f, options: slots.map((s) => ({ label: s, value: s })) };
        if (f.name === "addressText") return addressField;
        return f;
      }),
    };
  }, [dates, slots, coords, gpsStatus]);

  function handleGetLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGpsStatus("ok");
      },
      (err) => setGpsStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  /**
   * WhatsApp path: build the message, open wa.me, set status to "wa-opened".
   * No DB record is created — staff handles the request in WhatsApp.
   * Required-field validation is delegated to DynamicForm (same as DB path).
   */
  function handleWhatsAppSubmit(values: Record<string, unknown>) {
    if (!branchWhatsappLink) return;
    setSubmittedName(String(values.name ?? ""));
    const message = buildPickupMessage(values, branchName, whatsappTemplates);
    const url = appendWhatsappMessage(branchWhatsappLink, message);
    window.open(url, "_blank", "noopener,noreferrer");
    setStatus("wa-opened");
  }

  /**
   * DB-save path: creates a PickupRequest record staff can action in dashboard.
   * Secondary action when WhatsApp is available; primary when not.
   */
  async function handleDbSubmit(values: Record<string, unknown>) {
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg("");
    setSubmittedName(String(values.name ?? ""));

    try {
      const res = await fetch("/api/public/pickup-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchSlug,
          customerName: String(values.name ?? "").trim(),
          customerPhone: String(values.phone ?? "").trim(),
          customerEmail: String(values.email ?? "").trim() || undefined,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          addressText: String(values.addressText ?? "").trim() || undefined,
          requestedDate: (values.requestedDate as string) || undefined,
          requestedSlot: (values.requestedSlot as string) || undefined,
          notes: String(values.notes ?? "").trim() || undefined,
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((body as { error?: string } | null)?.error ?? "Gagal mengirim permintaan. Coba lagi.");
      }
      setSubmittedId((body as { data?: { id?: string } } | null)?.data?.id ?? "");
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Kesalahan tak terduga.");
    }
  }

  /**
   * DynamicForm only allows one onSubmit. We route to the right handler based
   * on which submit button was clicked — captured via intentRef set on click.
   */
  async function handleFormSubmit(values: Record<string, unknown>) {
    const intent = intentRef.current;
    if (intent === "whatsapp" && showWhatsApp) {
      handleWhatsAppSubmit(values);
      return;
    }
    await handleDbSubmit(values);
  }

  // ── WhatsApp-opened state ──
  if (status === "wa-opened") {
    return (
      <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-xl shadow-slate-900/5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366]/10">
          <MessageCircle className="h-7 w-7 text-[#25D366]" />
        </div>
        <h2 className="mt-4 font-serif text-2xl font-extrabold text-foreground">Pesan Terbuka di WhatsApp</h2>
        <p className="mt-2 text-sm text-slate-500">
          Terima kasih, {submittedName || "Pelanggan"}. Kirim chat WhatsApp yang
          sudah terisi otomatis untuk konfirmasi. Tim {branchName} akan
          menanggapi segera.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setSubmittedName("");
          }}
          className="mt-5 text-xs font-semibold text-slate-500 underline hover:text-slate-700"
        >
          Kirim permintaan lain
        </button>
      </div>
    );
  }

  // ── DB success state ──
  if (status === "success") {
    return (
      <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-xl shadow-slate-900/5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="mt-4 font-serif text-2xl font-extrabold text-foreground">Permintaan Terkirim</h2>
        <p className="mt-2 text-sm text-slate-500">
          Terima kasih, {submittedName || "Pelanggan"}. Permintaan pickup Anda telah
          kami terima. Tim {branchName} akan menghubungi Anda segera.
        </p>
        {submittedId && (
          <p className="mt-3 text-xs text-slate-400">
            Nomor referensi: <span className="font-mono">{submittedId}</span>
          </p>
        )}
      </div>
    );
  }

  // ── Form state ──
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
      <DynamicForm
        schema={schema}
        onSubmit={handleFormSubmit}
        disabled={status === "submitting"}
        hideActions
      >
        {/* ponytail: hideActions replaces DynamicForm's default submit with
         * our own intent-aware buttons. Validation still runs because the
         * buttons are type="submit" inside the same <form>. */}
        <div className="col-span-2 mt-2 space-y-3">
          {showWhatsApp ? (
            <>
              <button
                type="submit"
                onClick={() => (intentRef.current = "whatsapp")}
                disabled={status === "submitting"}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-[#25D366]/30 transition-all hover:bg-[#1FB855] hover:shadow-[#25D366]/40 disabled:opacity-60"
              >
                {status === "submitting" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <MessageCircle className="h-5 w-5" />
                )}
                Kirim via WhatsApp
              </button>
              <button
                type="submit"
                onClick={() => (intentRef.current = "db")}
                disabled={status === "submitting"}
                className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
              >
                atau simpan tanpa WhatsApp
              </button>
            </>
          ) : (
            <button
              type="submit"
              onClick={() => (intentRef.current = "db")}
              disabled={status === "submitting"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-amber-600 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-brand/25 transition-all hover:opacity-90 disabled:opacity-60"
            >
              {status === "submitting" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              Ajukan Pickup
            </button>
          )}
        </div>
      </DynamicForm>

      {status === "error" && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {branchAddress && (
        <p className="mt-3 text-center text-xs text-slate-400">
          Outlet: {branchName} — {branchAddress}
        </p>
      )}
    </div>
  );
}

// ── GPS + Address combo, rendered inside DynamicForm ──────────────────
function PickupAddressField({
  value,
  onChange,
  coords,
  gpsStatus,
  onGetLocation,
}: {
  value: string;
  onChange: (v: string) => void;
  coords: { latitude: number; longitude: number } | null;
  gpsStatus: "idle" | "locating" | "ok" | "denied" | "error";
  onGetLocation: () => void;
}) {
  const mapsLink = coords
    ? `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`
    : null;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-end">
        <button
          type="button"
          onClick={onGetLocation}
          disabled={gpsStatus === "locating"}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-brand transition-colors hover:bg-amber-100 disabled:opacity-50"
        >
          {gpsStatus === "locating" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : gpsStatus === "ok" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <LocateFixed className="h-3.5 w-3.5" />
          )}
          {gpsStatus === "ok" ? "Lokasi Terkunci" : gpsStatus === "locating" ? "Mencari..." : "Deteksi GPS"}
        </button>
      </div>

      {gpsStatus === "denied" && (
        <p className="mb-2 text-xs text-amber-600">Izin lokasi ditolak. Silakan isi alamat manual di bawah.</p>
      )}
      {gpsStatus === "error" && (
        <p className="mb-2 text-xs text-amber-600">Tidak dapat mendeteksi lokasi. Silakan isi alamat manual.</p>
      )}
      {mapsLink && (
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
        >
          <MapPin className="h-3.5 w-3.5" />
          Lihat di Google Maps
        </a>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Alamat lengkap / patokan (opsional jika GPS aktif)"
        rows={2}
        className={`${inputClass} resize-none`}
      />
    </div>
  );
}
