import type { GarmentDetail } from "@/components/pos/garment-breakdown-editor";

export interface OrderItem {
  id: string;
  serviceId: string;
  serviceName: string;
  quantity: number;
  weightKg: number | null;
  pricePerUnit: number;
  subtotal: number;
  notes: string | null;
  garmentBreakdown: { name: string; qty: number }[] | null;
}

export interface OrderPayment {
  id: string;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  paidAt: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: "RECEIVED" | "IN_PROGRESS" | "READY" | "DELIVERED";
  totalAmount: number;
  discountAmount: number;
  discountType: string | null;
  paidAmount: number;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID";
  notes: string | null;
  createdAt: string;
  receivedAt: string | null;
  inProgressAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  customerBalance: number;
  /** Tenant QRIS image URL (settings.website.qrisImageUrl) — null if unset. */
  qrisUrl: string | null;
  /** Branch receipt/footer terms — drives the WhatsApp receipt {{terms}}. */
  invoiceFooter: string | null;
  /** Branch thermal-paper size ("58mm"/"80mm"/"56mm"); null → default 58mm. */
  printerPaperSize: string | null;
  orderItems: OrderItem[];
  payments: OrderPayment[];
}

// Edit-mode shapes (used by OrderEditForm)
export interface EditService {
  id: string;
  name: string;
  pricingType: "PER_KG" | "PER_ITEM";
  basePrice: number;
  isActive: boolean;
  isDefaultSpeed: boolean;
  groupId: string | null;
  group: { id: string; name: string } | null;
}

export interface EditCustomer {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

export interface EditLineItem {
  serviceId: string;
  quantity: string;
  weightKg: string;
  garmentBreakdown: GarmentDetail[];
}

export type PayFormState = {
  amount: string;
  paymentMethod: "CASH" | "DEPOSIT" | "QRIS" | "TRANSFER";
  notes: string;
  paidAt: string;
};
