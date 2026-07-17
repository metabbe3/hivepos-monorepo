import type { FieldDef, FormSchema } from "./types";

// ─── Shared Field Helpers ────────────────────────────────────
/** Standard "Catatan" textarea used across customer/expense forms. */
const notesField = (colSpan: 1 | 2 = 2): FieldDef => ({
  name: "notes",
  label: "Catatan",
  type: "textarea",
  placeholder: "Catatan tambahan (opsional)",
  colSpan,
});

// ─── Customer Form ───────────────────────────────────────────
export const customerSchema: FormSchema = {
  id: "customer",
  apiEndpoint: "/api/customers",
  submitLabel: "Simpan Pelanggan",
  successMessage: "Pelanggan berhasil disimpan",
  editable: true,
  layout: { columns: 2 },
  fields: [
    {
      name: "name",
      label: "Nama",
      type: "text",
      required: true,
      placeholder: "Nama pelanggan",
      validate: (v) => (!v || String(v).trim().length < 2 ? "Nama minimal 2 karakter" : null),
    },
    {
      name: "phone",
      label: "Telepon",
      type: "tel",
      required: false,
      placeholder: "08xxxxxxxxxx (opsional)",
      validate: (v) => {
        const s = String(v ?? "").trim();
        return s && !/^[0-9+\-\s]{6,}$/.test(s) ? "Nomor telepon salah." : null;
      },
    },
    {
      name: "email",
      label: "Email",
      type: "email",
      placeholder: "Email (opsional)",
    },
    notesField(),
  ],
};

// ─── Expense Form ────────────────────────────────────────────
export const expenseSchema: FormSchema = {
  id: "expense",
  apiEndpoint: "/api/expenses",
  submitLabel: "Simpan Pengeluaran",
  successMessage: "Pengeluaran berhasil dicatat",
  editable: true,
  layout: { columns: 2 },
  fields: [
    {
      name: "amount",
      label: "Jumlah",
      type: "currency",
      required: true,
      placeholder: "50000",
      validate: (v) => (!v || Number(v) <= 0 ? "Jumlah harus lebih dari 0" : null),
    },
    {
      name: "categoryId",
      label: "Kategori",
      type: "select",
      required: true,
      placeholder: "Pilih kategori",
      optionsEndpoint: "/api/expense-categories",
    },
    {
      name: "date",
      label: "Tanggal",
      type: "date",
      required: true,
      defaultValue: new Date().toISOString().split("T")[0],
    },
    {
      name: "description",
      label: "Catatan",
      type: "textarea",
      placeholder: "Catatan tambahan (opsional)",
      colSpan: 2,
    },
  ],
};

// ─── Inventory / Stock Item Form ─────────────────────────────
export const stockItemSchema: FormSchema = {
  id: "stock-item",
  apiEndpoint: "/api/stock-items",
  submitLabel: "Simpan Item",
  successMessage: "Item inventory berhasil disimpan",
  editable: true,
  layout: { columns: 2 },
  fields: [
    {
      name: "name",
      label: "Nama Item",
      type: "text",
      required: true,
      placeholder: "Detergent, Sabun, Softener",
    },
    {
      name: "unit",
      label: "Satuan",
      type: "select",
      required: true,
      placeholder: "Pilih satuan",
      options: [
        { label: "kg", value: "kg" },
        { label: "liter", value: "liter" },
        { label: "pcs", value: "pcs" },
        { label: "box", value: "box" },
        { label: "botol", value: "botol" },
        { label: "galon", value: "galon" },
      ],
    },
    {
      name: "currentQuantity",
      label: "Jumlah Saat Ini",
      type: "number",
      required: true,
      placeholder: "0",
      min: 0,
      step: 0.001,
    },
    {
      name: "lowStockThreshold",
      label: "Minimum Stok",
      type: "number",
      placeholder: "0",
      min: 0,
      step: 0.001,
    },
    {
      name: "purchasePricePerUnit",
      label: "Harga per Satuan",
      type: "currency",
      placeholder: "0",
    },
  ],
};

// ─── Staff / User Form ───────────────────────────────────────
export const staffSchema: FormSchema = {
  id: "staff",
  apiEndpoint: "/api/users",
  submitLabel: "Simpan Staff",
  successMessage: "Staff berhasil ditambahkan",
  editable: true,
  layout: { columns: 2 },
  fields: [
    {
      name: "name",
      label: "Nama",
      type: "text",
      required: true,
      placeholder: "Nama lengkap",
    },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      placeholder: "staff@laundry.com",
      validate: (v) => (!v || !String(v).includes("@") ? "Format email salah." : null),
    },
    {
      name: "phone",
      label: "Telepon",
      type: "tel",
      placeholder: "08xxxxxxxxxx",
      validate: (v) => {
        const s = String(v ?? "").trim();
        return s && !/^[0-9+\-\s]{6,}$/.test(s) ? "Nomor telepon salah." : null;
      },
    },
    {
      name: "roleId",
      label: "Role",
      type: "select",
      required: true,
      placeholder: "Pilih role",
      optionsEndpoint: "/api/roles",
      optionsValueKey: "id",
      optionsLabelKey: "name",
    },
    {
      name: "branchId",
      label: "Outlet",
      type: "select",
      required: true,
      placeholder: "Pilih outlet",
      optionsEndpoint: "/api/branches",
      optionsValueKey: "id",
      optionsLabelKey: "name",
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      showPasswordToggle: true,
      placeholder: "Minimal 8 karakter",
      colSpan: 2,
      condition: (values) => !values.id, // only show on create
      validate: (v, all) => !all.id && (!v || String(v).length < 8) ? "Kata sandi minimal 8 karakter." : null,
    },
  ],
};

// ─── Profile Form ────────────────────────────────────────────
export const profileSchema: FormSchema = {
  id: "profile",
  apiEndpoint: "/api/users",
  method: "PATCH",
  submitLabel: "Update Profil",
  successMessage: "Profil berhasil diperbarui",
  editable: true,
  layout: { columns: 2 },
  fields: [
    {
      name: "name",
      label: "Nama",
      type: "text",
      required: true,
      placeholder: "Nama lengkap",
    },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      placeholder: "anda@bisnis.com",
      disabled: true,
    },
    {
      name: "phone",
      label: "Telepon",
      type: "tel",
      placeholder: "08xxxxxxxxxx",
      validate: (v) => {
        const s = String(v ?? "").trim();
        return s && !/^[0-9+\-\s]{6,}$/.test(s) ? "Nomor telepon salah." : null;
      },
    },
  ],
};

// ─── Login Form ──────────────────────────────────────────────
export const loginSchema: FormSchema = {
  id: "login",
  apiEndpoint: "/api/auth/callback/credentials", // unused — onSubmit override
  submitLabel: "Masuk",
  layout: { columns: 1 },
  touchTargets: true,
  submitFullWidth: true,
  fields: [
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      autocomplete: "email",
      placeholder: "anda@bisnis.com",
      validate: (v) => (!v || !String(v).includes("@") ? "Format email salah." : null),
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      required: true,
      autocomplete: "current-password",
      placeholder: "••••••••",
      showPasswordToggle: true,
    },
    {
      name: "remember",
      label: "Ingat saya",
      type: "checkbox",
      defaultValue: true,
    },
  ],
};

// ─── Super Admin Login Form ─────────────────────────────────
// ponytail: identical shape to loginSchema; the scope discrimination happens in
// lib/auth.ts authorize() via the `scope: "super-admin"` flag passed by the
// login page's onSubmit. Separate id/labels just for UI clarity.
export const superAdminLoginSchema: FormSchema = {
  id: "super-admin-login",
  apiEndpoint: "/api/auth/callback/credentials", // unused — onSubmit override
  submitLabel: "Masuk Panel",
  layout: { columns: 1 },
  touchTargets: true,
  submitFullWidth: true,
  fields: [
    {
      name: "email",
      label: "Email Platform Staff",
      type: "email",
      required: true,
      autocomplete: "email",
      placeholder: "admin@hivepos.id",
      validate: (v) => (!v || !String(v).includes("@") ? "Format email salah." : null),
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      required: true,
      autocomplete: "current-password",
      placeholder: "••••••••",
      showPasswordToggle: true,
    },
    {
      name: "remember",
      label: "Ingat saya",
      type: "checkbox",
      defaultValue: true,
    },
  ],
};

// ─── Register Form ───────────────────────────────────────────
export const registerSchema: FormSchema = {
  id: "register",
  apiEndpoint: "/api/register", // unused — onSubmit override
  submitLabel: "Buat Bisnis Saya",
  layout: { columns: 1 },
  touchTargets: true,
  submitFullWidth: true,
  fields: [
    {
      name: "businessName",
      label: "Nama Bisnis",
      type: "text",
      required: true,
      placeholder: "contoh: Laundry Berkah Jaya",
      validate: (v) => (!v || String(v).trim().length < 2 ? "Nama bisnis minimal 2 karakter" : null),
    },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      placeholder: "anda@bisnis.com",
      validate: (v) => (!v || !String(v).includes("@") ? "Format email salah." : null),
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      showPasswordToggle: true,
      placeholder: "Minimal 6 karakter",
      condition: (values) => !values.googleId,
      validate: (v, all) => !all.googleId && (!v || String(v).length < 6) ? "Kata sandi minimal 6 karakter." : null,
    },
    {
      name: "agreeTerms",
      label: "Saya setuju dengan Syarat & Ketentuan hivePOS",
      type: "checkbox",
      required: true,
      validate: (v: unknown) => (!v ? "Anda harus menyetujui Syarat & Ketentuan." : null),
    },
  ],
};

// ─── Pickup Request Public Form ──────────────────────────────
export const pickupPublicSchema: FormSchema = {
  id: "pickup-public",
  apiEndpoint: "/api/public/pickup-requests", // unused — onSubmit override
  submitLabel: "Ajukan Pickup",
  layout: { columns: 2 },
  touchTargets: true,
  fields: [
    {
      name: "name",
      label: "Nama Lengkap",
      type: "text",
      required: true,
      placeholder: "Nama Anda",
      validate: (v) => (!v || String(v).trim().length < 2 ? "Nama minimal 2 karakter" : null),
    },
    {
      name: "phone",
      label: "No. WhatsApp",
      type: "tel",
      required: true,
      placeholder: "08xxxxxxxxxx",
      validate: (v) => (!v || String(v).trim().length < 8 ? "Nomor telepon salah." : null),
    },
    {
      name: "email",
      label: "Email (opsional)",
      type: "email",
      placeholder: "email@contoh.com",
    },
    {
      name: "addressText",
      label: "Alamat",
      type: "textarea",
      placeholder: "Alamat lengkap / patokan",
      colSpan: 2,
    },
    {
      name: "requestedDate",
      label: "Tanggal (opsional)",
      type: "select",
      placeholder: "Pilih tanggal",
      options: [], // populated at page render from nextDates()
    },
    {
      name: "requestedSlot",
      label: "Slot (opsional)",
      type: "select",
      placeholder: "Pilih slot",
      options: [], // populated at page render from slotDays
    },
    {
      name: "notes",
      label: "Catatan (opsional)",
      type: "textarea",
      placeholder: "Jumlah kg perkiraan, jenis pakaian, dsb.",
      colSpan: 2,
    },
  ],
};

// ─── Branch Form ─────────────────────────────────────────────
export const branchSchema: FormSchema = {
  id: "branch",
  apiEndpoint: "/api/branches",
  submitLabelKey: "common.save",
  successMessage: "Branch berhasil disimpan",
  editable: true,
  layout: { columns: 1 },
  fields: [
    {
      name: "name",
      labelKey: "common.name",
      type: "text",
      required: true,
      validate: (v) => (!v || String(v).trim().length < 1 ? "Nama wajib diisi" : null),
    },
    { name: "address", labelKey: "branches.address", type: "text" },
    { name: "phone", labelKey: "common.phone", type: "tel" },
    {
      name: "invoiceFooter",
      labelKey: "branches.invoiceFooter",
      type: "textarea",
      placeholderKey: "branches.invoiceFooterPlaceholder",
      colSpan: 1,
    },
  ],
};

// ─── Service Form (laundry) ──────────────────────────────────
export const serviceSchema: FormSchema = {
  id: "service",
  apiEndpoint: "/api/services",
  submitLabelKey: "common.save",
  successMessage: "Service berhasil disimpan",
  editable: true,
  layout: { columns: 2 },
  fields: [
    {
      name: "name",
      labelKey: "common.name",
      type: "text",
      required: true,
      validate: (v) => (!v || String(v).trim().length < 1 ? "Nama wajib diisi" : null),
    },
    { name: "description", labelKey: "common.description", type: "textarea", colSpan: 2 },
    {
      name: "pricingType",
      labelKey: "services.pricingType",
      type: "select",
      defaultValue: "PER_KG",
      options: [
        { label: "Per Kilo", value: "PER_KG" },
        { label: "Per Item", value: "PER_ITEM" },
      ],
    },
    {
      name: "basePrice",
      labelKey: "services.price",
      type: "currency",
      required: true,
      placeholder: "0",
      validate: (v) => (!v || Number(v) <= 0 ? "Harga harus lebih dari 0" : null),
    },
    {
      name: "groupId",
      labelKey: "services.group",
      type: "select",
      placeholderKey: "services.noGroup",
      options: [], // populated at render from serviceGroups
    },
    {
      name: "commissionType",
      labelKey: "services.commissionType",
      type: "select",
      defaultValue: "NONE",
      options: [
        { label: "Tanpa Komisi", value: "NONE" },
        { label: "Flat (Rp)", value: "FLAT" },
        { label: "Persen (%)", value: "PERCENTAGE" },
      ],
    },
    {
      name: "commissionValue",
      labelKey: "services.commissionValue",
      type: "number",
      placeholder: "0",
      condition: (values) => values.commissionType !== "NONE",
      validate: (v, all) =>
        all.commissionType && all.commissionType !== "NONE" && (!v || Number(v) <= 0)
          ? "Nilai komisi harus lebih dari 0"
          : null,
    },
  ],
  // Ponytail: parse strings → numbers at submit. UI keeps them as strings for input ergonomics.
  transform: (values) => ({
    ...values,
    basePrice: values.basePrice === "" ? 0 : Number(values.basePrice),
    commissionValue:
      values.commissionType && values.commissionType !== "NONE"
        ? values.commissionValue === "" ? 0 : Number(values.commissionValue)
        : 0,
    groupId: values.groupId === "__none" || values.groupId === "" ? undefined : values.groupId,
    description: values.description || undefined,
  }),
};

// ─── Tenant Ticket Form ──────────────────────────────────────
export const ticketFormSchema: FormSchema = {
  id: "ticket",
  apiEndpoint: "/api/tickets",
  submitLabel: "Submit Ticket",
  successMessage: "Ticket submitted. We'll reply shortly.",
  editable: false,
  layout: { columns: 2 },
  fields: [
    {
      name: "subject",
      label: "Subject",
      type: "text",
      required: true,
      colSpan: 2,
      placeholder: "Briefly describe the issue",
      validate: (v) => (!v || String(v).trim().length < 3 ? "Subjek terlalu pendek — minimal 3 huruf." : null),
    },
    {
      name: "category",
      label: "Category",
      type: "select",
      required: true,
      defaultValue: "OTHER",
      options: [
        { label: "Billing", value: "BILLING" },
        { label: "Technical", value: "TECHNICAL" },
        { label: "Account", value: "ACCOUNT" },
        { label: "Other", value: "OTHER" },
      ],
    },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      required: true,
      defaultValue: "NORMAL",
      options: [
        { label: "Low", value: "LOW" },
        { label: "Normal", value: "NORMAL" },
        { label: "High", value: "HIGH" },
        { label: "Urgent", value: "URGENT" },
      ],
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      required: true,
      colSpan: 2,
      placeholder: "Tell us more about what happened...",
      validate: (v) => (!v || String(v).trim().length < 10 ? "Deskripsi terlalu pendek — minimal 10 huruf." : null),
    },
  ],
};

// ─── Schema Registry ─────────────────────────────────────────
export const schemas = {
  customer: customerSchema,
  expense: expenseSchema,
  "stock-item": stockItemSchema,
  staff: staffSchema,
  profile: profileSchema,
  ticket: ticketFormSchema,
} as const;

export type SchemaId = keyof typeof schemas;
