/**
 * Client-side ESC/POS printer connector.
 * Supports Web Bluetooth API (Bluetooth) and Web Serial API (USB).
 * Falls back gracefully when APIs are not available.
 * Supports 80mm (48 chars/line) and 58mm (32 chars/line) paper sizes.
 */

import { getLineWidth, ESCPOS_CODE_PAGE } from "./printer-shared";

const ESC = 0x1b;
const GS = 0x1d;

function cmd(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

class ClientEscPosBuilder {
  private parts: Uint8Array[] = [];
  readonly lineWidth: number;

  constructor(paperSize?: string) {
    this.lineWidth = getLineWidth(paperSize);
  }

  init(): this {
    this.parts.push(cmd(ESC, 0x40));
    // Select WPC1252 so latin1-encoded text renders correctly (Indonesian/Latin).
    this.parts.push(cmd(ESC, 0x74, ESCPOS_CODE_PAGE)); // ESC t n
    return this;
  }

  align(n: 0 | 1 | 2 = 0): this {
    this.parts.push(cmd(ESC, 0x61, n));
    return this;
  }

  bold(): this {
    this.parts.push(cmd(ESC, 0x45, 1));
    return this;
  }

  normal(): this {
    this.parts.push(cmd(ESC, 0x45, 0));
    return this;
  }

  text(str: string): this {
    // latin1-encoded to match the WPC1252 code table selected in init().
    // TextEncoder only does UTF-8, so truncate each code unit to a byte.
    const bytes = new Uint8Array(str.length + 1);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
    bytes[str.length] = 0x0a; // "\n"
    this.parts.push(bytes);
    return this;
  }

  line(char = "-"): this {
    return this.text(char.repeat(this.lineWidth));
  }

  big(): this {
    this.parts.push(cmd(ESC, 0x21, 0x10));
    return this;
  }

  small(): this {
    this.parts.push(cmd(ESC, 0x21, 0x00));
    return this;
  }

  feed(n = 1): this {
    this.parts.push(cmd(ESC, 0x64, n));
    return this;
  }

  cut(): this {
    this.parts.push(cmd(GS, 0x56, 0x00));
    return this;
  }

  build(): Uint8Array {
    const total = this.parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const part of this.parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }
}

// ============================
// Web Bluetooth API Connector
// ============================

const PRINTER_SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const PRINTER_CHAR_UUID = "00002af1-0000-1000-8000-00805f9b34fb";

// Alternative common service UUIDs for thermal printers
const ALT_SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "0000ff00-0000-1000-8000-00805f9b34fb",
];

export interface BluetoothPrinter {
  type: "bluetooth";
  name: string;
  device: BluetoothDevice;
}

export async function isBluetoothAvailable(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  return !!(navigator as any).bluetooth?.getAvailability?.();
}

export async function scanBluetoothPrinters(): Promise<BluetoothPrinter[]> {
  const nav = navigator as any;
  if (!nav.bluetooth) return [];

  try {
    const device = await nav.bluetooth.requestDevice({
      filters: [
        { services: [PRINTER_SERVICE_UUID] },
        { services: ["e7810a71-73ae-499d-8c15-faa9aef0c3f2"] },
        { services: ["0000ff00-0000-1000-8000-00805f9b34fb"] },
      ],
      optionalServices: ALT_SERVICE_UUIDS,
    });

    return [{
      type: "bluetooth",
      name: device.name || "Bluetooth Printer",
      device,
    }];
  } catch {
    // User cancelled the dialog or no device found
    return [];
  }
}

export async function printViaBluetooth(
  device: BluetoothDevice,
  data: Uint8Array
): Promise<void> {
  const nav = navigator as any;
  if (!nav.bluetooth) throw new Error("Web Bluetooth not available");

  const server = await device.gatt?.connect();
  if (!server) throw new Error("Failed to connect to GATT server");

  let service: BluetoothRemoteGATTService | null = null;
  for (const uuid of ALT_SERVICE_UUIDS) {
    try {
      service = await server.getPrimaryService(uuid);
      if (service) break;
    } catch {
      continue;
    }
  }

  if (!service) throw new Error("Printer service not found");

  let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  // Try known characteristic UUIDs
  const charUUIDs = [
    PRINTER_CHAR_UUID,
    "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
    "0000ff02-0000-1000-8000-00805f9b34fb",
  ];

  for (const uuid of charUUIDs) {
    try {
      characteristic = await service.getCharacteristic(uuid);
      if (characteristic) break;
    } catch {
      continue;
    }
  }

  if (!characteristic) throw new Error("Printer characteristic not found");

  // Send data in chunks (BLE has MTU limit, typically 512 bytes)
  const CHUNK = 100;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, Math.min(i + CHUNK, data.length));
    await characteristic.writeValue(chunk);
    // Small delay between chunks
    await new Promise((r) => setTimeout(r, 20));
  }
}

// ============================
// Web Serial API Connector (USB)
// ============================

export interface SerialPrinter {
  type: "serial";
  name: string;
  id: string; // vendorId:productId — stable across sessions, used for silent reconnect
  port: SerialPort;
}

/** Stable per-port id from USB descriptors: "0451:16a8". "unknown" if missing. */
function serialPortId(port: SerialPort): string {
  const info = port.getInfo();
  const v = info.usbVendorId?.toString(16).padStart(4, "0") ?? "unknown";
  const p = info.usbProductId?.toString(16).padStart(4, "0") ?? "unknown";
  return `${v}:${p}`;
}

export async function isSerialAvailable(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  return !!(navigator as any).serial;
}

export async function scanSerialPrinters(): Promise<SerialPrinter[]> {
  const nav = navigator as any;
  if (!nav.serial) return [];

  try {
    const port = await nav.serial.requestPort();
    const id = serialPortId(port);
    return [{
      type: "serial",
      name: `USB Printer (${id})`,
      id,
      port,
    }];
  } catch {
    return [];
  }
}

export async function printViaSerial(
  port: SerialPort,
  data: Uint8Array
): Promise<void> {
  await port.open({ baudRate: 9600 });

  const writer = port.writable?.getWriter();
  if (!writer) {
    await port.close();
    throw new Error("Failed to get writer");
  }

  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
    await port.close();
  }
}

// ============================
// Build test receipt
// ============================

export function buildTestReceipt(host?: string, paperSize?: string): Uint8Array {
  const p = new ClientEscPosBuilder(paperSize);
  p.init()
    .align(1)
    .bold()
    .text("TEST PRINT")
    .normal()
    .line()
    .text(`Time: ${new Date().toLocaleString("id-ID")}`);
  if (host) p.text(`Target: ${host}`);
  p.line()
    .text("If you can read this,")
    .text("your printer is working!")
    .feed(3)
    .cut();
  return p.build();
}

// ============================
// Build full receipt (client-side, for Bluetooth/USB)
// ============================

export function buildClientReceipt(order: {
  orderNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  notes: string | null;
  createdAt: string;
  customer: { name: string; phone: string };
  orderItems: { quantity: number; weightKg: number | null; subtotal: number; service: { name: string; pricingType: string }; garmentBreakdown?: { name: string; qty: number }[] | null }[];
  branch: { name: string | null; address?: string | null; phone?: string | null };
}, businessName: string, paperSize?: string): Uint8Array {
  function pad(str: string, len: number, align: "left" | "right" = "left"): string {
    const s = String(str);
    if (align === "right") return s.padStart(len);
    return s.padEnd(len);
  }

  function formatRp(amount: number): string {
    return "Rp" + Math.round(amount).toLocaleString("id-ID");
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const p = new ClientEscPosBuilder(paperSize);
  const W = p.lineWidth;
  const singleLine = "-".repeat(W);

  // Column widths adapt to paper size
  const labelPad = W >= 48 ? 12 : 8;

  p.init().align(1).bold().text(businessName).normal();
  if (order.branch?.address) p.text(order.branch.address);
  if (order.branch?.phone) p.text(order.branch.phone);
  p.feed(1).align(0);
  p.text(singleLine);
  p.text(`${pad("Order", labelPad)}: ${order.orderNumber}`);
  p.text(`${pad("Date", labelPad)}: ${formatDate(order.createdAt)}`);
  p.text(`${pad("Status", labelPad)}: ${order.status.replace(/_/g, " ")}`);
  p.text(singleLine);
  p.text(`${pad("Customer", labelPad)}: ${order.customer.name}`);
  p.text(`${pad("Phone", labelPad)}: ${order.customer.phone}`);
  p.text(singleLine);
  p.bold().text("ITEMS").normal();

  for (const item of order.orderItems) {
    const qty = item.service.pricingType === "PER_KG" ? `${item.weightKg}kg` : `${item.quantity}x`;
    const price = formatRp(item.subtotal);
    const maxName = W - qty.length - price.length - 3;
    const name = item.service.name.length > maxName ? item.service.name.slice(0, maxName - 1) + "~" : item.service.name;
    p.text(` ${pad(name, maxName)} ${pad(qty, qty.length, "right")} ${pad(price, price.length, "right")}`);

    // Garment breakdown for PER_KG items
    if (item.garmentBreakdown && item.garmentBreakdown.length > 0) {
      for (const g of item.garmentBreakdown) {
        p.text(`   - ${g.name}: ${g.qty}`);
      }
    }
  }

  const priceCol = W >= 48 ? 16 : 12;

  p.text(singleLine);
  p.bold().text(`${pad("TOTAL", W - priceCol, "left")}${pad(formatRp(order.totalAmount), priceCol, "right")}`).normal();
  p.text(`${pad("Dibayar", labelPad)}: ${formatRp(order.paidAmount)}`);
  const remaining = order.totalAmount - order.paidAmount;
  if (remaining > 0) p.text(`${pad("Sisa", labelPad)}: ${formatRp(remaining)}`);

  if (order.notes) {
    p.text(singleLine);
    p.text(`Notes: ${order.notes}`);
  }

  p.text(singleLine);
  p.align(1);
  p.text("Terima kasih atas kepercayaan Anda");
  p.feed(3).cut();

  return p.build();
}

export { ClientEscPosBuilder };

// ============================
// Remember + silent reconnect ("auto on")
// ============================

const LAST_PRINTER_KEY = "pos.lastPrinter";

export type RememberedPrinterKind = "bluetooth" | "serial" | "network";

export interface RememberedPrinter {
  kind: RememberedPrinterKind;
  id: string;   // bluetooth: device id; serial: vendorId:productId; network: "host:port"
  label: string;
}

export function rememberPrinter(entry: RememberedPrinter): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_PRINTER_KEY, JSON.stringify(entry));
  } catch {
    // storage may be unavailable (private mode) — auto-reconnect is a nice-to-have, ignore.
  }
}

export function getRememberedPrinter(): RememberedPrinter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_PRINTER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RememberedPrinter;
    if (!parsed?.kind || !parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function forgetPrinter(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LAST_PRINTER_KEY);
  } catch {
    // ignore
  }
}

/**
 * Silent reconnect to a previously-paired Bluetooth printer (no picker dialog).
 * Uses navigator.bluetooth.getDevices() — Chrome 103+. Returns the device or null.
 */
export async function reconnectBluetooth(): Promise<BluetoothDevice | null> {
  const nav = navigator as any;
  if (!nav.bluetooth?.getDevices) return null;
  const remembered = getRememberedPrinter();
  if (!remembered || remembered.kind !== "bluetooth") return null;

  try {
    const devices: BluetoothDevice[] = await nav.bluetooth.getDevices();
    const match = devices.find((d) => d.id === remembered.id);
    if (!match) return null;
    // Trigger an advertisement scan so the browser can reach a device that's gone to sleep.
    if (nav.bluetooth?.requestWatchAdvertisements && match.watchAdvertisements) {
      try {
        await nav.bluetooth.requestWatchAdvertisements(match);
      } catch {
        // some Chromium versions throw if already watching — ignore, connect attempt continues.
      }
    }
    return match;
  } catch {
    return null;
  }
}

/**
 * Silent reconnect to a previously-paired USB/Serial printer (no picker dialog).
 * Uses navigator.serial.getPorts() — returns ports the user already granted
 * access to. Matches by the remembered vendorId:productId id.
 *
 * ponytail: this closes the "remembered USB printer still pops the picker every
 * print" gap — getPorts() needs no user gesture for already-granted ports.
 */
export async function reconnectSerial(): Promise<SerialPort | null> {
  const nav = navigator as any;
  if (!nav.serial?.getPorts) return null;
  const remembered = getRememberedPrinter();
  if (!remembered || remembered.kind !== "serial") return null;

  try {
    const ports: SerialPort[] = await nav.serial.getPorts();
    // Match by id (vendorId:productId). Legacy entries stored the label as id —
    // fall back to first granted port if id is non-descriptive but kind matches.
    const byId = ports.find((port) => serialPortId(port) === remembered.id);
    if (byId) return byId;
    // ponytail: legacy fallback — old remembered rows stored "USB Printer (xxx)"
    // as id. If only one port is granted, trust it; otherwise force re-pick.
    return ports.length === 1 ? ports[0] : null;
  } catch {
    return null;
  }
}
