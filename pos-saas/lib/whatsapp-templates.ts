/**
 * Per-tenant customizable WhatsApp message templates.
 *
 * 12 templates covering order updates, tracking, pickup, pricing, public CTAs,
 * payment reminders, and 4 kanban status messages. Defaults are lifted verbatim
 * from the pre-feature hardcoded locations so behavior is preserved when a
 * tenant has no overrides.
 *
 * Rendering rules:
 *  - body = (override non-empty ? override : defaultBody)
 *  - `{{var}}` replaced with String(vars[name] ?? "")
 *  - Unreplaced `{{var}}` (var not provided) stripped to empty string
 *  - 3+ consecutive newlines collapsed to 2 (so empty optional vars don't
 *    leave awkward gaps)
 *  - Leading/trailing whitespace trimmed
 *
 * No conditional syntax. Callers pre-format complex values (currency, dates,
 * multi-line lists) before invoking the renderer.
 */

export type TemplateId =
  | "order.receipt"
  | "order.trackingShare"
  | "track.customerInquiry"
  | "pickup.request"
  | "tenantSite.orderCta"
  | "tenantSite.askCta"
  | "priceEstimator.summary"
  | "unpaid.reminder"
  | "status.READY"
  | "status.RECEIVED"
  | "status.IN_PROGRESS"
  | "status.DELIVERED";

export type TemplateCategory = "Orders" | "Status" | "Payments" | "Public";

export interface TemplateVar {
  name: string;
  description: string;
  required: boolean;
}

export interface TemplateManifestEntry {
  id: TemplateId;
  label: string;
  description: string;
  category: TemplateCategory;
  variables: TemplateVar[];
  defaultBody: string;
  maxLength: number;
}

// ─── Default bodies (verbatim from pre-feature code) ──────────────────────

const ORDER_RECEIPT_DEFAULT = `Halo, ini terkait pesanan *{{orderNumber}}*
Status: *{{statusLabel}}*
Layanan:
{{serviceLines}}
{{extrasLine}}
Biaya: {{totalAmount}}
{{remainingLine}}{{qrisLine}}{{readyGreeting}}
Lacak pesanan: {{trackingUrl}}{{terms}}`;

const ORDER_TRACKING_SHARE_DEFAULT = `Halo {{customerName}}, pesanan laundry kamu bisa dilacak di sini:

{{trackingUrl}}

Total: {{totalAmount}}
Status: {{statusLabel}}`;

const TRACK_INQUIRY_DEFAULT = `Halo {{branchName}}, saya mau tanya status pesanan saya.

Nomor pesanan: {{orderNumber}}
Status saat ini: {{currentStatus}}
Lacak: {{trackingUrl}}`;

const PICKUP_REQUEST_DEFAULT = `Halo {{branchName}}, saya mau request pickup laundry.

{{pickupDetails}}`;

const TENANT_SITE_ORDER_CTA_DEFAULT = `Halo {{tenantName}}, saya mau pesan layanan laundry. Apakah bisa dibantu?`;

const TENANT_SITE_ASK_CTA_DEFAULT = `Halo {{tenantName}}, saya mau tanya tentang layanan & harga. Terima kasih.`;

const PRICE_ESTIMATOR_DEFAULT = `Halo, saya ingin memesan layanan laundry:

{{orderLines}}

Estimasi total: {{total}}

Terima kasih!`;

const UNPAID_REMINDER_DEFAULT = `Halo, ini pengingat bahwa pesanan {{orderNumber}} belum lunas. Mohon untuk melakukan pembayaran. Terima kasih! - hivePOS`;

const STATUS_READY_DEFAULT = `Halo, pakaian Anda untuk pesanan {{orderNumber}} sudah siap diambil. Terima kasih! - hivePOS`;

const STATUS_RECEIVED_DEFAULT = `Halo, pesanan Anda {{orderNumber}} sedang kami proses. Terima kasih! - hivePOS`;

const STATUS_IN_PROGRESS_DEFAULT = `Halo, pesanan Anda {{orderNumber}} sedang dikerjakan. Terima kasih! - hivePOS`;

const STATUS_DELIVERED_DEFAULT = `Halo, terima kasih sudah menggunakan hivePOS! Pesanan {{orderNumber}} telah selesai.`;

// ─── Manifest ─────────────────────────────────────────────────────────────

export const WHATSAPP_TEMPLATES: TemplateManifestEntry[] = [
  {
    id: "order.receipt",
    label: "Order Update",
    description: "Dikirim saat staff update status order dari dashboard.",
    category: "Orders",
    maxLength: 2000,
    defaultBody: ORDER_RECEIPT_DEFAULT,
    variables: [
      { name: "orderNumber", description: "Nomor pesanan (mis. LD-001)", required: true },
      { name: "statusLabel", description: "Label status terlokalisasi (mis. Diterima)", required: true },
      { name: "serviceLines", description: "Daftar layanan multi-baris", required: true },
      { name: "extrasLine", description: "Total piece count line, kosong kalau semua per-kg", required: false },
      { name: "totalAmount", description: "Total biaya terformat (mis. Rp 25.000)", required: true },
      { name: "remainingLine", description: "Sisa pembayaran, kosong kalau lunas", required: false },
      { name: "qrisLine", description: "Link QRIS dari website settings, kosong kalau belum di-set / lunas", required: false },
      { name: "readyGreeting", description: "Pesan 'siap diambil', kosong kalau bukan READY", required: false },
      { name: "trackingUrl", description: "URL lacak pesanan", required: true },
      { name: "terms", description: "Syarat & Ketentuan dari invoiceFooter branch, kosong kalau belum di-set", required: false },
    ],
  },
  {
    id: "order.trackingShare",
    label: "Share Tracking Link",
    description: "Staff membagikan link lacak ke customer dari halaman order.",
    category: "Orders",
    maxLength: 1000,
    defaultBody: ORDER_TRACKING_SHARE_DEFAULT,
    variables: [
      { name: "customerName", description: "Nama customer", required: true },
      { name: "trackingUrl", description: "URL lacak pesanan", required: true },
      { name: "totalAmount", description: "Total terformat", required: true },
      { name: "statusLabel", description: "Label status", required: true },
    ],
  },
  {
    id: "track.customerInquiry",
    label: "Customer Inquiry (Track Page)",
    description: "Tombol 'Tanya Status' di halaman lacak public.",
    category: "Public",
    maxLength: 1000,
    defaultBody: TRACK_INQUIRY_DEFAULT,
    variables: [
      { name: "branchName", description: "Nama cabang", required: true },
      { name: "orderNumber", description: "Nomor pesanan", required: true },
      { name: "currentStatus", description: "Label status saat ini", required: true },
      { name: "trackingUrl", description: "URL halaman lacak", required: true },
    ],
  },
  {
    id: "pickup.request",
    label: "Pickup Request Form",
    description: "Form pickup laundry di public page.",
    category: "Public",
    maxLength: 1500,
    defaultBody: PICKUP_REQUEST_DEFAULT,
    variables: [
      { name: "branchName", description: "Nama cabang", required: true },
      { name: "pickupDetails", description: "Detail pickup multi-baris (nama, telp, alamat, dll.)", required: true },
    ],
  },
  {
    id: "tenantSite.orderCta",
    label: "Public Site — Order CTA",
    description: "Tombol 'Pesan Sekarang' di website laundry.",
    category: "Public",
    maxLength: 500,
    defaultBody: TENANT_SITE_ORDER_CTA_DEFAULT,
    variables: [
      { name: "tenantName", description: "Nama laundry", required: true },
    ],
  },
  {
    id: "tenantSite.askCta",
    label: "Public Site — Ask CTA",
    description: "Tombol 'Tanya Layanan' di website laundry.",
    category: "Public",
    maxLength: 500,
    defaultBody: TENANT_SITE_ASK_CTA_DEFAULT,
    variables: [
      { name: "tenantName", description: "Nama laundry", required: true },
    ],
  },
  {
    id: "priceEstimator.summary",
    label: "Price Estimator",
    description: "Ringkasan hitung harga di public page.",
    category: "Public",
    maxLength: 1500,
    defaultBody: PRICE_ESTIMATOR_DEFAULT,
    variables: [
      { name: "orderLines", description: "Daftar layanan terpilih multi-baris", required: true },
      { name: "total", description: "Estimasi total terformat", required: true },
    ],
  },
  {
    id: "unpaid.reminder",
    label: "Unpaid Reminder",
    description: "Pengingat pembayaran dari dashboard.",
    category: "Payments",
    maxLength: 500,
    defaultBody: UNPAID_REMINDER_DEFAULT,
    variables: [
      { name: "orderNumber", description: "Nomor pesanan", required: true },
    ],
  },
  {
    id: "status.READY",
    label: "Kanban — Ready",
    description: "Pesan cepat dari kanban saat status READY.",
    category: "Status",
    maxLength: 500,
    defaultBody: STATUS_READY_DEFAULT,
    variables: [
      { name: "orderNumber", description: "Nomor pesanan", required: true },
    ],
  },
  {
    id: "status.RECEIVED",
    label: "Kanban — Received",
    description: "Pesan cepat dari kanban saat status RECEIVED.",
    category: "Status",
    maxLength: 500,
    defaultBody: STATUS_RECEIVED_DEFAULT,
    variables: [
      { name: "orderNumber", description: "Nomor pesanan", required: true },
    ],
  },
  {
    id: "status.IN_PROGRESS",
    label: "Kanban — In Progress",
    description: "Pesan cepat dari kanban saat status IN_PROGRESS.",
    category: "Status",
    maxLength: 500,
    defaultBody: STATUS_IN_PROGRESS_DEFAULT,
    variables: [
      { name: "orderNumber", description: "Nomor pesanan", required: true },
    ],
  },
  {
    id: "status.DELIVERED",
    label: "Kanban — Delivered",
    description: "Pesan cepat dari kanban saat status DELIVERED.",
    category: "Status",
    maxLength: 500,
    defaultBody: STATUS_DELIVERED_DEFAULT,
    variables: [
      { name: "orderNumber", description: "Nomor pesanan", required: true },
    ],
  },
];

export const WHATSAPP_TEMPLATE_MAP: Record<TemplateId, TemplateManifestEntry> =
  Object.fromEntries(WHATSAPP_TEMPLATES.map((t) => [t.id, t])) as Record<
    TemplateId,
    TemplateManifestEntry
  >;

export type TemplateOverrides = Partial<Record<TemplateId, string>>;

/**
 * Render a single template: pick body (override ?? default), substitute vars,
 * collapse 3+ newlines, strip unreplaced {{var}} placeholders, trim ends.
 */
export function renderWhatsAppTemplate(
  id: TemplateId,
  vars: Record<string, string | number | undefined | null>,
  overrides?: TemplateOverrides,
): string {
  const entry = WHATSAPP_TEMPLATE_MAP[id];
  if (!entry) {
    // ponytail: unknown id → empty string. Caller's template-id bug surfaces
    // as an empty WA body, not a crash. Cheaper than throwing for a UI typo.
    return "";
  }
  const override = overrides?.[id];
  let body = override && override.trim().length > 0 ? override : entry.defaultBody;

  for (const [k, v] of Object.entries(vars)) {
    body = body.split(`{{${k}}}`).join(v == null ? "" : String(v));
  }
  // Strip any unreplaced {{var}} (var not provided by caller).
  body = body.replace(/\{\{[^}]+\}\}/g, "");
  // Collapse 3+ consecutive newlines → max 2. Empty optional vars no longer
  // leave awkward gaps. Cheap regex, runs once per render.
  body = body.replace(/\n{3,}/g, "\n\n");
  return body.trim();
}
