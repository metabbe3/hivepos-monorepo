import net from "net";
import { getLineWidth, ESCPOS_CODE_PAGE } from "./printer-shared";

// ESC/POS command helpers for thermal printers
// Supports 80mm (48 chars/line) and 58mm (32 chars/line) paper

const ESC = 0x1b;
const GS = 0x1d;

function cmd(...bytes: number[]): Buffer {
  return Buffer.from(bytes);
}

export class EscPosBuilder {
  private parts: Buffer[] = [];
  readonly lineWidth: number;

  constructor(paperSize?: string) {
    this.lineWidth = getLineWidth(paperSize);
  }

  /** Initialize / reset printer */
  init(): this {
    this.parts.push(cmd(ESC, 0x40)); // ESC @
    // Select the WPC1252 character code table so latin1-encoded text renders
    // correctly (Indonesian/Latin special chars). See printer-shared.ts.
    this.parts.push(cmd(ESC, 0x74, ESCPOS_CODE_PAGE)); // ESC t n
    return this;
  }

  /** Set alignment: 0=left, 1=center, 2=right */
  align(n: 0 | 1 | 2 = 0): this {
    this.parts.push(cmd(ESC, 0x61, n)); // ESC a n
    return this;
  }

  /** Enable bold */
  bold(): this {
    this.parts.push(cmd(ESC, 0x45, 1)); // ESC E 1
    return this;
  }

  /** Disable bold */
  normal(): this {
    this.parts.push(cmd(ESC, 0x45, 0)); // ESC E 0
    return this;
  }

  /** Add a text line (auto-appends newline). latin1-encoded to match the
   * WPC1252 code table selected in init() — ASCII bytes are unchanged. */
  text(str: string): this {
    this.parts.push(Buffer.from(str + "\n", "latin1"));
    return this;
  }

  /** Add a separator line */
  line(char = "-"): this {
    return this.text(char.repeat(this.lineWidth));
  }

  /** Double-height line (bigger text) */
  big(): this {
    this.parts.push(cmd(ESC, 0x21, 0x10)); // ESC ! 0x10 (double height)
    return this;
  }

  /** Reset to normal size */
  small(): this {
    this.parts.push(cmd(ESC, 0x21, 0x00)); // ESC ! 0x00
    return this;
  }

  /** Feed n blank lines */
  feed(n = 1): this {
    this.parts.push(cmd(ESC, 0x64, n)); // ESC d n
    return this;
  }

  /** Full cut */
  cut(): this {
    this.parts.push(cmd(GS, 0x56, 0x00)); // GS V 0
    return this;
  }

  /** Build the final buffer */
  build(): Buffer {
    return Buffer.concat(this.parts);
  }
}

/** Pad a string to a given width */
function pad(str: string, len: number, align: "left" | "right" = "left"): string {
  const s = String(str);
  if (align === "right") return s.padStart(len);
  return s.padEnd(len);
}

/** Build receipt buffer from order data */
export function buildReceipt(order: {
  orderNumber: string;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  customer: { name: string; phone: string };
  orderItems: { quantity: number; weightKg: number | null; subtotal: number; service: { name: string; pricingType: string }; garmentBreakdown?: { name: string; qty: number }[] | null }[];
  branch: { name: string | null };
}, businessName: string, paperSize?: string): Buffer {
  const p = new EscPosBuilder(paperSize);
  const W = p.lineWidth;
  const singleLine = "-".repeat(W);
  const doubleLine = "=".repeat(W);

  // Column widths adapt to paper size
  const labelPad = W >= 48 ? 12 : 8;
  const priceCol = W >= 48 ? 16 : 12;

  // Header
  p.init().align(1).bold().text(businessName).normal().feed(1).align(0);
  p.text(doubleLine);

  // Order info
  p.text(`${pad("Order", labelPad)}: ${order.orderNumber}`);
  p.text(`${pad("Date", labelPad)}: ${formatDateShort(order.createdAt)}`);
  p.text(`${pad("Status", labelPad)}: ${order.status.replace(/_/g, " ")}`);

  p.text(singleLine);

  // Customer
  p.text(`${pad("Customer", labelPad)}: ${order.customer.name}`);
  p.text(`${pad("Phone", labelPad)}: ${order.customer.phone}`);

  p.text(singleLine);

  // Items
  p.bold().text("ITEMS").normal();
  for (const item of order.orderItems) {
    const qty = item.service.pricingType === "PER_KG"
      ? `${item.weightKg}kg`
      : `${item.quantity}x`;
    const price = formatRupiah(item.subtotal);
    const maxName = W - qty.length - price.length - 3;
    const name = item.service.name.length > maxName
      ? item.service.name.slice(0, maxName - 1) + "~"
      : item.service.name;
    p.text(` ${pad(name, maxName)} ${pad(qty, qty.length, "right")} ${pad(price, price.length, "right")}`);

    // Garment breakdown for PER_KG items
    if (item.garmentBreakdown && item.garmentBreakdown.length > 0) {
      for (const g of item.garmentBreakdown) {
        p.text(`   - ${g.name}: ${g.qty}`);
      }
    }
  }

  p.text(singleLine);

  // Total
  p.bold().text(`${pad("TOTAL", W - priceCol, "left")}${pad(formatRupiah(order.totalAmount), priceCol, "right")}`).normal();

  p.text(singleLine);

  // Notes
  if (order.notes) {
    p.text(`Notes: ${order.notes}`);
    p.text(singleLine);
  }

  p.text(doubleLine).feed(2).cut();

  return p.build();
}

function formatRupiah(amount: number): string {
  return "Rp" + Math.round(amount).toLocaleString("id-ID");
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Send buffer to network printer via TCP */
export function sendToPrinter(data: Buffer, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);

    socket.on("error", (err) => {
      socket.destroy();
      reject(new Error(`Printer connection failed: ${err.message}`));
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Printer connection timed out"));
    });

    socket.connect(port, host, () => {
      socket.write(data, () => {
        socket.end();
        resolve();
      });
    });
  });
}
