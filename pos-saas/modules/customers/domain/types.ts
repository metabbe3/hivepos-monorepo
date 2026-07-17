/** Domain-level types for the Customers module. No Prisma imports. */

export type CustomerStatus = "NEW" | "ACTIVE" | "AT_RISK" | "LAPSED";

export type DepositTransactionType = "TOP_UP" | "DEDUCTION" | "REFUND" | "ADJUSTMENT";

export type SortField = "createdAt" | "name" | "orderCount" | "totalSpent" | "lastOrderDate";
export type SortOrder = "asc" | "desc";
