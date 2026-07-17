// ponytail: plain English label maps for the English-only super-admin panel.
// Customer-facing surfaces use lib/i18n.ts instead.
// Raw value preserved as fallback at every call site so future enum additions
// still render until added here.

export const TICKET_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  BILLING: "Billing",
  TECHNICAL: "Technical",
  ACCOUNT: "Account",
  OTHER: "Other",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  TRIAL: "Trial",
  ACTIVE: "Active",
  PAST_DUE: "Past Due",
  CANCELED: "Canceled",
  EXPIRED: "Expired",
};

export const SAAS_PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

export const USER_ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

export const SUPER_ADMIN_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SUPPORT: "Support",
};
