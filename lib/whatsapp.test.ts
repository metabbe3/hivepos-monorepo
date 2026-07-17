import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  buildGenericWhatsAppUrl,
  buildOrderWhatsAppUrl,
  type OrderMessageInput,
} from "./whatsapp";

const stubT = (key: string) => `[${key}]`;

const baseOrder: OrderMessageInput = {
  orderNumber: "LD-001",
  status: "RECEIVED",
  statusLabelKey: "orders.status.RECEIVED",
  totalAmount: 25000,
  paidAmount: 0,
  orderItems: [
    {
      serviceName: "Cuci Kering",
      weightKg: 3,
      quantity: 0,
      garmentBreakdown: null,
    },
  ],
};

describe("normalizePhone", () => {
  it("converts a leading 0 to the 62 country code", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
  });

  it("strips the + sign and whitespace", () => {
    expect(normalizePhone("+62 812 3456")).toBe("628123456");
  });

  it("leaves an already-canonical 62-prefixed number alone", () => {
    expect(normalizePhone("6281234567")).toBe("6281234567");
  });

  it("strips any non-digit characters", () => {
    expect(normalizePhone("(021) 555-1234")).toBe("62215551234");
  });

  it("returns the empty string for an all-non-digit input", () => {
    expect(normalizePhone("++--()")).toBe("");
  });
});

describe("buildGenericWhatsAppUrl", () => {
  it("produces a wa.me URL with the normalized phone and URL-encoded message", () => {
    const url = buildGenericWhatsAppUrl("0812", "Hello world");
    expect(url).toBe("https://wa.me/62812?text=Hello%20world");
  });

  it("URL-encodes special characters in the message", () => {
    const url = buildGenericWhatsAppUrl("0812", "Halo & selamat datang!");
    expect(url).toContain("text=Halo%20%26%20selamat%20datang!");
  });

  it("encodes multi-line messages with %0A", () => {
    const url = buildGenericWhatsAppUrl("0812", "line1\nline2");
    expect(url).toContain("line1%0Aline2");
  });
});

describe("buildOrderWhatsAppUrl", () => {
  it("includes the order number and localized status label", () => {
    const url = buildOrderWhatsAppUrl("081234567890", baseOrder, stubT);
    expect(url).toContain("LD-001");
    expect(url).toContain("%5Borders.status.RECEIVED%5D");
  });

  it("starts with https://wa.me/62...", () => {
    const url = buildOrderWhatsAppUrl("081234567890", baseOrder, stubT);
    expect(url.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
  });

  it("includes the total amount formatted as Rupiah", () => {
    const url = buildOrderWhatsAppUrl("0812", baseOrder, stubT);
    expect(url).toContain("Biaya");
    expect(url).toContain("25.000");
  });

  it("includes the QRIS line (using the configured qrisUrl) when unpaid", () => {
    const partial = buildOrderWhatsAppUrl(
      "0812",
      {
        ...baseOrder,
        totalAmount: 25000,
        paidAmount: 10000,
        qrisUrl: "https://laundry.example/qris.png",
      },
      stubT,
    );
    const decoded = decodeURIComponent(partial.split("text=")[1]);
    expect(decoded).toContain("Sisa pembayaran");
    expect(decoded).toContain("Pembayaran via QRIS");
    expect(decoded).toContain("https://laundry.example/qris.png");
  });

  it("omits the QRIS line when no qrisUrl is configured (no dead link)", () => {
    // baseOrder is unpaid but has no qrisUrl — the old code emitted a broken
    // /QRIS.JPG link here. Now the QRIS line is simply absent.
    const url = buildOrderWhatsAppUrl("0812", baseOrder, stubT);
    const decoded = decodeURIComponent(url.split("text=")[1]);
    expect(decoded).toContain("Sisa pembayaran"); // remainder still shown
    expect(decoded).not.toContain("QRIS");
    expect(decoded).not.toContain("QRIS.JPG");
  });

  it("never emits the dead /QRIS.JPG link (regression guard)", () => {
    const cases = [
      baseOrder,
      { ...baseOrder, qrisUrl: "https://x/q.png" },
      { ...baseOrder, totalAmount: 25000, paidAmount: 25000, qrisUrl: "https://x/q.png" },
    ];
    for (const order of cases) {
      const url = buildOrderWhatsAppUrl("0812", order, stubT);
      expect(url).not.toContain("QRIS.JPG");
    }
  });

  it("omits QRIS line when fully paid (even with qrisUrl configured)", () => {
    const paid = buildOrderWhatsAppUrl(
      "0812",
      {
        ...baseOrder,
        totalAmount: 25000,
        paidAmount: 25000,
        qrisUrl: "https://x/q.png",
      },
      stubT,
    );
    expect(paid).not.toContain("QRIS");
    expect(paid).not.toContain("Sisa");
  });

  it("omits QRIS line when overpaid (no negative remainder)", () => {
    const overpaid = buildOrderWhatsAppUrl(
      "0812",
      { ...baseOrder, totalAmount: 25000, paidAmount: 30000 },
      stubT,
    );
    expect(overpaid).not.toContain("QRIS");
  });

  it("appends the ready-pickup greeting when status is READY", () => {
    const ready = buildOrderWhatsAppUrl(
      "0812",
      { ...baseOrder, status: "READY", statusLabelKey: "orders.status.READY" },
      stubT,
    );
    expect(ready).toContain("Pesanan%20Anda%20sudah%20siap%20diambil");
  });

  it("omits the ready-pickup greeting for non-READY statuses", () => {
    const url = buildOrderWhatsAppUrl("0812", baseOrder, stubT);
    expect(url).not.toContain("sudah%20siap%20diambil");
  });

  it("includes the tracking URL with the order number", () => {
    const url = buildOrderWhatsAppUrl("0812", baseOrder, stubT);
    expect(url).toContain("track");
    expect(url).toContain("LD-001");
  });

  it("includes the terms block from the branch invoiceFooter when set", () => {
    const url = buildOrderWhatsAppUrl(
      "0812",
      {
        ...baseOrder,
        invoiceFooter: "Komplain max 3 hari setelah diambil\nGanti rugi max Rp 200.000",
      },
      stubT,
    );
    const decoded = decodeURIComponent(url.split("text=")[1]);
    expect(decoded).toContain("Syarat & Ketentuan");
    expect(decoded).toContain("Komplain max 3 hari");
    expect(decoded).toContain("200.000");
  });

  it("omits the terms block when invoiceFooter is empty (no fake terms)", () => {
    const url = buildOrderWhatsAppUrl("0812", baseOrder, stubT);
    const decoded = decodeURIComponent(url.split("text=")[1]);
    expect(decoded).not.toContain("Syarat");
    expect(decoded).not.toContain("200.000");
  });

  it("counts pieces for per-item orders (not per-kg)", () => {
    const perItem = buildOrderWhatsAppUrl(
      "0812",
      {
        ...baseOrder,
        orderItems: [
          {
            serviceName: "Setrika",
            weightKg: null,
            quantity: 5,
            garmentBreakdown: [
              { name: "Shirt", qty: 3 },
              { name: "Pants", qty: 2 },
            ],
          },
        ],
      },
      stubT,
    );
    // 3 + 2 = 5 pieces
    expect(perItem).toContain("Total");
    expect(perItem).toContain("5%20pcs");
  });

  it("omits the Total: N pcs line when all items are per-kg", () => {
    const allPerKg = buildOrderWhatsAppUrl("0812", baseOrder, stubT);
    expect(allPerKg).not.toContain("pcs");
  });

  it("includes garment breakdown as a sub-line when present", () => {
    const url = buildOrderWhatsAppUrl(
      "0812",
      {
        ...baseOrder,
        orderItems: [
          {
            serviceName: "Setrika",
            weightKg: null,
            quantity: 5,
            garmentBreakdown: [
              { name: "Shirt", qty: 3 },
              { name: "Pants", qty: 2 },
            ],
          },
        ],
      },
      stubT,
    );
    // Garment breakdown is part of the message — check the decoded text.
    const decoded = decodeURIComponent(url.split("text=")[1]);
    expect(decoded).toContain("Shirt: 3");
    expect(decoded).toContain("Pants: 2");
  });
});
