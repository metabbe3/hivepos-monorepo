import { z } from "zod/v4";

const emailField = z.email();
const passwordField = (min = 6) => z.string().min(min);

// Clock PIN: 4-8 digits, reject weak (all-same / sequential). Used at SET time
// (quick-staff, set-pin). Clock VERIFY uses a looser schema (old PINs must still clock).
const isWeakPin = (p: string) => {
  if (/^(\d)\1{3,}$/.test(p)) return true; // 0000, 1111, …
  const asc = "0123456789", desc = "9876543210";
  return asc.includes(p) || desc.includes(p); // 1234, 4321, …
};
export const pinField = z
  .string()
  .regex(/^\d{4}$/, "PIN harus tepat 4 digit angka.")
  .refine((p) => !isWeakPin(p), "PIN terlalu mudah ditebak (jangan 1111/1234).");
const slugField = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung.");

export const loginSchema = z.object({
  email: emailField,
  password: passwordField(),
});

export const customerSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi."),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const serviceSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi."),
  description: z.string().optional(),
  pricingType: z.enum(["PER_KG", "PER_ITEM"]),
  basePrice: z.coerce.number().positive("Harga harus lebih dari 0."),
  commissionType: z.enum(["NONE", "FLAT", "PERCENTAGE"]).optional(),
  commissionValue: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
  isDefaultSpeed: z.boolean().optional(),
  groupId: z.string().optional().or(z.literal("")),
});

export const serviceGroupSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi."),
  sortOrder: z.number().int().min(0).optional(),
});

export const serviceGroupReorderSchema = z.object({
  groups: z.array(z.object({ id: z.string().min(1), sortOrder: z.number().int().min(0) })),
});

export const garmentItemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().min(1),
});

export const orderItemSchema = z.object({
  serviceId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  weightKg: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
  garmentBreakdown: z.array(garmentItemSchema).optional(),
});

export const orderSchema = z.object({
  customerId: z.string().min(1, "Pelanggan wajib dipilih."),
  items: z.array(orderItemSchema).min(1, "Pilih minimal satu layanan."),
  // ponytail: cap notes at 2000 chars — bounds IDB row size + limits XSS
  // surface (React already escapes). 2000 is comfortably above any sane
  // kasir handoff note.
  notes: z.string().max(2000).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountAmount: z.coerce.number().min(0).optional(),
  receivedAt: z.string().optional(),
});

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Jumlah harus lebih dari 0."),
  paymentMethod: z.enum(["CASH", "DEPOSIT", "QRIS", "TRANSFER"]),
  notes: z.string().optional(),
  paidAt: z
    .string()
    .optional()
    .refine((s) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s), "Format tanggal tidak valid")
    .refine((s) => !s || !Number.isNaN(new Date(s).getTime()), "Tanggal tidak valid"),
});

export const statusUpdateSchema = z.object({
  status: z.enum(["RECEIVED", "IN_PROGRESS", "READY", "DELIVERED"]),
});

export const orderNotesUpdateSchema = z.object({
  notes: z.string().optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type ServiceGroupInput = z.infer<typeof serviceGroupSchema>;
export type ServiceGroupReorderInput = z.infer<typeof serviceGroupReorderSchema>;
export const orderUpdateSchema = orderSchema;
export type OrderInput = z.infer<typeof orderSchema>;
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;

export const branchSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi."),
  address: z.string().optional(),
  phone: z.string().optional(),
  invoiceFooter: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  googleMapsLink: z.string().nullable().optional(),
  whatsappLink: z.string().nullable().optional(),
  operatingHours: z.record(z.string(), z.string()).nullable().optional(),
  printerHost: z.string().nullable().optional(),
  printerPort: z.number().int().min(1).max(65535).optional(),
  printerName: z.string().nullable().optional(),
  printerEnabled: z.boolean().optional(),
  printerPaperSize: z.enum(["56mm", "58mm", "80mm"]).optional(),
  isActive: z.boolean().optional(),
});

export const userCreateSchema = z.object({
  email: emailField,
  name: z.string().min(1, "Nama wajib diisi."),
  phone: z.string().optional(),
  roleId: z.string().min(1, "Peran wajib dipilih."),
  branchId: z.string().min(1, "Outlet wajib dipilih."),
  password: passwordField(6),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi.").optional(),
  phone: z.string().optional(),
  roleId: z.string().optional(),
  branchId: z.string().min(1, "Outlet wajib dipilih.").optional(),
  password: passwordField(6).optional(),
});

export type BranchInput = z.infer<typeof branchSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const stockItemSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi."),
  unit: z.string().min(1, "Satuan wajib diisi."),
  currentQuantity: z.coerce.number().min(0).optional(),
  // ponytail: form marks these optional + DB defaults to 0; coerce empty/NaN to 0 instead of rejecting.
  lowStockThreshold: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? 0 : v),
    z.coerce.number().min(0, "Batas minimum tidak boleh negatif."),
  ),
  purchasePricePerUnit: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? 0 : v),
    z.coerce.number().min(0, "Harga tidak boleh negatif."),
  ),
  isActive: z.boolean().optional(),
});

export const stockMovementSchema = z.object({
  type: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().positive("Jumlah harus lebih dari 0."),
  notes: z.string().optional(),
  date: z.string().min(1, "Tanggal wajib diisi."),
});

export const expenseCategorySchema = z.object({
  name: z.string().min(1, "Nama wajib diisi."),
});

export const expenseSchema = z.object({
  amount: z.coerce.number().positive("Jumlah harus lebih dari 0."),
  description: z.string().optional(),
  date: z.string().min(1, "Tanggal wajib diisi."),
  categoryId: z.string().min(1, "Kategori wajib dipilih."),
});

export type StockItemInput = z.infer<typeof stockItemSchema>;
export type StockMovementInput = z.infer<typeof stockMovementSchema>;
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const depositTopUpSchema = z.object({
  amount: z.coerce.number().positive("Jumlah harus lebih dari 0."),
  paymentMethod: z.enum(["CASH", "QRIS", "TRANSFER"]),
  description: z.string().optional(),
});

export type DepositTopUpInput = z.infer<typeof depositTopUpSchema>;

export const registerSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi."),
  email: emailField,
  password: passwordField(6),
  businessName: z.string().min(1, "Nama usaha wajib diisi."),
  businessSlug: slugField,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const profileUpdateSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi.").optional(),
  phone: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: passwordField(6).optional(),
}).refine(
  (data) => {
    if (data.newPassword && !data.currentPassword) return false;
    return true;
  },
  { message: "Isi kata sandi lama untuk mengganti kata sandi.", path: ["currentPassword"] }
);

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const roleCreateSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi.").max(50),
  description: z.string().max(200).optional(),
  color: z.string().min(1).optional(),
  permissions: z.array(z.string()),
});

export const roleUpdateSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi.").max(50).optional(),
  description: z.string().max(200).nullable().optional(),
  color: z.string().min(1).optional(),
  permissions: z.array(z.string()).optional(),
});

// ponytail: per-tenant website settings stored in Tenant.settings.website.
// All optional — defaults are derived in the tenant-site page when blank.
// qrisImageUrl also surfaces on /track/[orderNumber] when set.
export const websiteSettingsSchema = z.object({
  tagline: z.string().max(160).optional(),
  heroPhotoUrl: z.string().url().max(1024).optional().or(z.literal("")),
  about: z.string().max(800).optional(),
  instagram: z.string().url().max(512).optional().or(z.literal("")),
  qrisImageUrl: z.string().url().max(2048).optional().or(z.literal("")),
  // ponytail: Phase 2 fields — trust signals, area, FAQ, testimonials.
  // All optional & nullable so older tenants without these still validate.
  googleRating: z.number().min(0).max(5).optional(),
  googleReviewCount: z.number().int().min(0).optional(),
  yearEstablished: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  avgProcessingMinutes: z.number().int().min(0).optional(),
  areaServed: z.array(z.string().max(100)).max(20).optional(),
  faqs: z
    .array(
      z.object({
        question: z.string().max(200),
        answer: z.string().max(1000),
      }),
    )
    .max(20)
    .optional(),
  testimonials: z
    .array(
      z.object({
        name: z.string().max(100),
        role: z.string().max(200).optional(),
        text: z.string().max(500),
        rating: z.number().min(1).max(5).optional(),
      }),
    )
    .max(12)
    .optional(),
});

export type RoleCreateInput = z.infer<typeof roleCreateSchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
export type WebsiteSettingsInput = z.infer<typeof websiteSettingsSchema>;

// ponytail: per-tenant WhatsApp templates. Sparse map of override strings.
// Generated from the manifest so there's a single source of truth.
// Missing keys = use default; empty-string = explicit reset to default.
import { WHATSAPP_TEMPLATES } from "./whatsapp-templates";
export const whatsappTemplatesSchema = z.object(
  Object.fromEntries(
    WHATSAPP_TEMPLATES.map((t) => [t.id, z.string().max(t.maxLength).optional()]),
  ),
);
export type WhatsappTemplatesInput = z.infer<typeof whatsappTemplatesSchema>;

// ── Tickets (tenant portal) ──

export const tenantTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  category: z.enum(["BILLING", "TECHNICAL", "ACCOUNT", "OTHER"]).default("OTHER"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export const ticketCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const ticketCsatSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().or(z.literal("")),
});

export type TenantTicketInput = z.infer<typeof tenantTicketSchema>;
export type TicketCommentInput = z.infer<typeof ticketCommentSchema>;
export type TicketCsatInput = z.infer<typeof ticketCsatSchema>;
