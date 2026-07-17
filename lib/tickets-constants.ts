// Client-safe constants extracted from lib/tickets.ts so client islands
// (ticket-row-actions) don't transitively import Prisma via lib/prisma.
export const TICKET_CATEGORIES = ["BILLING", "TECHNICAL", "ACCOUNT", "OTHER"] as const;
export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
