/** Branch record for list view (with counts). */
export interface BranchListItem {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  isFreeTier: boolean;
  coverageEnd: Date | null;
  createdAt: Date;
  counts: {
    users: number;
    orders: number;
    services: number;
    customers: number;
  };
}

/** Branch user for detail view. */
export interface BranchUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Branch record for detail view (with users + counts). */
export interface BranchDetail {
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
  coverageEnd: Date | null;
  createdAt: Date;
  users: BranchUser[];
  counts: {
    orders: number;
    services: number;
    customers: number;
  };
}
