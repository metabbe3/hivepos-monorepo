/**
 * WhatsApp deep-link construction.
 *
 * Extracted from `app/(dashboard)/laundry/orders/page.tsx` so the URL builder
 * is independently testable and reusable (e.g. for customer-detail pages,
 * pickup-request notifications, etc.).
 *
 * The function composes a localized order-update message and encodes it into
 * a `https://wa.me/<phone>?text=<message>` URL.
 */

import { formatCurrency } from "./format";
import {
  renderWhatsAppTemplate,
  type TemplateOverrides,
} from "./whatsapp-templates";

export interface OrderMessageItem {
  serviceName: string;
  /** kg value when pricing is PER_KG; null otherwise. */
  weightKg: number | null;
  /** quantity when pricing is PER_ITEM or FLAT. */
  quantity: number;
  /** Optional per-garment breakdown (e.g. "Shirt: 3, Pants: 2"). */
  garmentBreakdown: { name: string; qty: number }[] | null;
}

export interface OrderMessageInput {
  orderNumber: string;
  status: string;
  /** i18n key (e.g. "orders.status.RECEIVED") resolved by the caller's `t`. */
  statusLabelKey: string;
  totalAmount: number;
  paidAmount: number;
  orderItems: OrderMessageItem[];
  /** Tenant's configured QRIS image (settings.website.qrisImageUrl). When set
   * AND there's an unpaid remainder, a "Bayar via QRIS" line is included. */
  qrisUrl?: string | null;
  /** Branch receipt/footer terms ("Ketentuan") — rendered into {{terms}}.
   * Single source of truth, shared with the printed receipt + tracking page. */
  invoiceFooter?: string | null;
}

/**
 * Translator function — accepts a key, returns the localized string.
 * Matches the signature of `useTranslation().t`.
 */
export type Translator = (key: string) => string;

/**
 * Strip non-digits and normalize a phone number to international format
 * (assuming the Indonesian convention: leading "0" → "62" country code).
 *
 *   "0812-3456-7890" → "6281234567890"
 *   "+62 812 3456"   → "628123456"
 *   "6281234567"     → "6281234567"  (already canonical)
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  return digits;
}

/**
 * Build a generic wa.me URL for an arbitrary plaintext message.
 */
export function buildGenericWhatsAppUrl(phone: string, message: string): string {
  const waPhone = normalizePhone(phone);
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Append a pre-filled message to an existing wa.me URL.
 *
 * Use this when the WhatsApp link is already a full URL (e.g. Branch.whatsappLink
 * stored as "https://wa.me/6281234567890"). For raw phone numbers, use
 * buildGenericWhatsAppUrl() instead.
 *
 *   appendWhatsappMessage("https://wa.me/6281234567890", "Halo")
 *     → "https://wa.me/6281234567890?text=Halo"
 *
 *   appendWhatsappMessage("https://wa.me/6281234567890?src=web", "Halo")
 *     → "https://wa.me/6281234567890?src=web&text=Halo"
 *
 * Returns "" when baseLink is empty/null — caller checks falsy before rendering.
 */
export function appendWhatsappMessage(
  baseLink: string | null | undefined,
  message: string,
): string {
  if (!baseLink) return "";
  const sep = baseLink.includes("?") ? "&" : "?";
  return `${baseLink}${sep}text=${encodeURIComponent(message)}`;
}

/**
 * Build a wa.me URL containing an order-update message in the project's
 * standard format (status, items, total, optional QRIS link, tracking URL,
 * T&Cs).
 *
 * The QRIS payment link is only included when there's an unpaid remainder.
 * The tracking URL and origin are derived from `window.location.origin` when
 * available (browser) so the function is SSR-safe.
 */
export function buildOrderWhatsAppUrl(
  phone: string,
  order: OrderMessageInput,
  t: Translator,
  tenantOverrides?: TemplateOverrides,
): string {
  const remaining = order.totalAmount - order.paidAmount;
  const statusLabel = t(order.statusLabelKey);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Pre-format each section as a single string. Empty optional sections
  // become "" — the renderer collapses the resulting blank lines.
  const serviceLines = order.orderItems
    .map((i) => {
      const unit = i.weightKg ? `${i.weightKg}kg` : `${i.quantity}x`;
      let line = `- ${i.serviceName} (${unit})`;
      if (i.garmentBreakdown && i.garmentBreakdown.length > 0) {
        const details = i.garmentBreakdown
          .map((g) => `${g.name}: ${g.qty}`)
          .join(", ");
        line += `\n  ${details}`;
      }
      return line;
    })
    .join("\n");

  const totalPcs = order.orderItems.reduce((sum, i) => {
    if (i.weightKg) return sum;
    return sum + (i.garmentBreakdown?.reduce((s, g) => s + g.qty, 0) || i.quantity);
  }, 0);
  const extrasLine = totalPcs > 0 ? `Total: ${totalPcs} pcs` : "";

  // Honest, data-driven blocks — nothing hardcoded. The QRIS line only appears
  // when the tenant has configured a QRIS image (no more dead /QRIS.JPG link),
  // and the terms come from the branch's invoiceFooter (same "Ketentuan" shown
  // on the printed receipt + tracking page). Empty optionals collapse away.
  let remainingLine = "";
  let qrisLine = "";
  if (remaining > 0) {
    remainingLine = `Sisa pembayaran: ${formatCurrency(remaining)}`;
    if (order.qrisUrl) {
      qrisLine = `\n💰 Pembayaran via QRIS: ${order.qrisUrl}`;
    }
  }

  const readyGreeting =
    order.status === "READY" ? "\nPesanan Anda sudah siap diambil! 🎉" : "";

  const invoiceFooter = order.invoiceFooter?.trim();
  const terms = invoiceFooter
    ? `\n\n📋 Syarat & Ketentuan:\n${invoiceFooter}`
    : "";

  const body = renderWhatsAppTemplate(
    "order.receipt",
    {
      orderNumber: order.orderNumber,
      statusLabel,
      serviceLines,
      extrasLine,
      totalAmount: formatCurrency(order.totalAmount),
      remainingLine,
      qrisLine,
      readyGreeting,
      trackingUrl: `${origin}/track/${order.orderNumber}`,
      terms,
    },
    tenantOverrides,
  );

  return buildGenericWhatsAppUrl(phone, body);
}
