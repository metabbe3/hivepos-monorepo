/**
 * Shared thermal-printer layout constants used by BOTH the server-side
 * ESC/POS builder (lib/escpos.ts) and the client-side Web Bluetooth/Serial
 * builder (lib/client-printer.ts). Centralized so paper widths can't drift
 * between the two emit paths. Pure data + pure function — safe for browser.
 */

export const PAPER_WIDTHS: Record<string, number> = {
  "56mm": 30,
  "58mm": 32,
  "80mm": 48,
};

/** Characters-per-line for a paper size; defaults to 80mm (48). */
export function getLineWidth(paperSize?: string): number {
  return PAPER_WIDTHS[paperSize ?? "80mm"] ?? 48;
}

/**
 * ESC/POS character code table to select in `init()`. 16 = WPC1252
 * (Windows-1252), which covers Indonesian / Latin text (é, –, •, °, etc.).
 * Pair this with latin1-encoded text bytes — ASCII is byte-identical to the
 * previous UTF-8 output (no regression for ASCII-only receipts), and Latin
 * special chars now render instead of garbling on single-byte thermal printers.
 */
export const ESCPOS_CODE_PAGE = 16;
