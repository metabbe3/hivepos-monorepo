// ── List DTO ──

export interface BranchListItemDTO {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  isFreeTier: boolean;
  coverageEnd: string | null;
  createdAt: string;
  counts: {
    users: number;
    orders: number;
    services: number;
    customers: number;
  };
}

// ── Detail DTO ──

export interface BranchDetailDTO {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  invoiceFooter: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsLink: string | null;
  whatsappLink: string | null;
  operatingHours: Record<string, string> | null;
  printerHost: string | null;
  printerPort: number | null;
  printerName: string | null;
  printerEnabled: boolean;
  printerPaperSize: string | null;
  isActive: boolean;
  isFreeTier: boolean;
  coverageEnd: string | null;
  createdAt: string;
  users: { id: string; name: string; email: string; role: string }[];
  counts: {
    orders: number;
    services: number;
    customers: number;
  };
}

// ── Create / Update inputs match the Zod branchSchema shape ──

export interface BranchInput {
  name: string;
  address?: string;
  phone?: string;
  invoiceFooter?: string;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsLink?: string | null;
  whatsappLink?: string | null;
  operatingHours?: Record<string, string> | null;
  printerHost?: string | null;
  printerPort?: number;
  printerName?: string | null;
  printerEnabled?: boolean;
  printerPaperSize?: "56mm" | "58mm" | "80mm";
  isActive?: boolean;
}
