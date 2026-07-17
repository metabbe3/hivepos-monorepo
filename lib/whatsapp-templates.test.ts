import { describe, it, expect } from "vitest";
import {
  WHATSAPP_TEMPLATES,
  WHATSAPP_TEMPLATE_MAP,
  renderWhatsAppTemplate,
  type TemplateId,
} from "./whatsapp-templates";

describe("WHATSAPP_TEMPLATES manifest invariants", () => {
  it("has 12 entries", () => {
    expect(WHATSAPP_TEMPLATES).toHaveLength(12);
  });

  it("has unique ids", () => {
    const ids = WHATSAPP_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has a non-empty defaultBody", () => {
    for (const t of WHATSAPP_TEMPLATES) {
      expect(t.defaultBody.trim().length).toBeGreaterThan(0);
    }
  });

  it("every {{var}} in a defaultBody is declared in that entry's variables", () => {
    // Catches typos: a default referencing an undeclared var would be silently
    // stripped at render time, breaking the default.
    for (const t of WHATSAPP_TEMPLATES) {
      const matches = t.defaultBody.match(/\{\{([^}]+)\}\}/g) ?? [];
      const declared = new Set(t.variables.map((v) => v.name));
      for (const m of matches) {
        const name = m.slice(2, -2);
        expect(declared.has(name), `${t.id}: {{${name}}} not declared`).toBe(true);
      }
    }
  });

  it("WHATSAPP_TEMPLATE_MAP has every id", () => {
    for (const t of WHATSAPP_TEMPLATES) {
      expect(WHATSAPP_TEMPLATE_MAP[t.id]).toBe(t);
    }
  });
});

describe("renderWhatsAppTemplate", () => {
  it("returns the default body when no overrides", () => {
    const out = renderWhatsAppTemplate(
      "status.READY",
      { orderNumber: "LD-001" },
    );
    expect(out).toBe(
      "Halo, pakaian Anda untuk pesanan LD-001 sudah siap diambil. Terima kasih! - hivePOS",
    );
  });

  it("uses non-empty override instead of default", () => {
    const out = renderWhatsAppTemplate(
      "status.READY",
      { orderNumber: "LD-001" },
      { "status.READY": "Hi {{orderNumber}} — ready!" },
    );
    expect(out).toBe("Hi LD-001 — ready!");
  });

  it("empty-string override falls back to default", () => {
    const out = renderWhatsAppTemplate(
      "status.READY",
      { orderNumber: "LD-001" },
      { "status.READY": "   " },
    );
    expect(out).toContain("LD-001");
    expect(out).toContain("siap diambil");
  });

  it("substitutes multiple variables in one template", () => {
    const out = renderWhatsAppTemplate(
      "order.trackingShare",
      {
        customerName: "Budi",
        trackingUrl: "https://hivepos.id/track/LD-001",
        totalAmount: "Rp 25.000",
        statusLabel: "Diproses",
      },
    );
    expect(out).toContain("Budi");
    expect(out).toContain("https://hivepos.id/track/LD-001");
    expect(out).toContain("Rp 25.000");
    expect(out).toContain("Diproses");
    expect(out).not.toContain("{{");
  });

  it("missing optional var is replaced with empty string", () => {
    const out = renderWhatsAppTemplate(
      "order.receipt",
      {
        orderNumber: "LD-001",
        statusLabel: "Diterima",
        serviceLines: "- Cuci Kering (3kg)",
        totalAmount: "Rp 25.000",
        trackingUrl: "https://hivepos.id/track/LD-001",
        // extrasLine, remainingLine, qrisLine, readyGreeting, terms intentionally missing
      },
    );
    expect(out).toContain("LD-001");
    expect(out).not.toContain("{{");
    expect(out).toContain("Rp 25.000");
    expect(out).toContain("track/LD-001");
  });

  it("collapses 3+ consecutive newlines into max 2", () => {
    // Template with empty optional vars would leave gaps otherwise.
    const out = renderWhatsAppTemplate(
      "order.receipt",
      {
        orderNumber: "LD-001",
        statusLabel: "Diterima",
        serviceLines: "- Cuci Kering (3kg)",
        totalAmount: "Rp 25.000",
        trackingUrl: "https://hivepos.id/track/LD-001",
        extrasLine: "",
        remainingLine: "",
        qrisLine: "",
        readyGreeting: "",
        terms: "",
      },
    );
    expect(out).not.to.match(/\n{3,}/);
  });

  it("handles numeric variable values", () => {
    const out = renderWhatsAppTemplate(
      "status.READY",
      { orderNumber: 42 },
    );
    expect(out).toContain("42");
  });

  it("handles null and undefined variable values", () => {
    const out = renderWhatsAppTemplate(
      "status.READY",
      { orderNumber: undefined as unknown as string },
    );
    expect(out).not.toContain("{{orderNumber}}");
    expect(out).toContain("pesanan  sudah siap"); // double space from empty subst
  });

  it("returns empty string for unknown template id", () => {
    // ponytail: caller's bug surfaces as empty body, not a crash.
    const out = renderWhatsAppTemplate(
      "unknown.template" as TemplateId,
      {},
    );
    expect(out).toBe("");
  });

  it("trims leading and trailing whitespace from the rendered body", () => {
    const out = renderWhatsAppTemplate(
      "status.READY",
      { orderNumber: "LD-001" },
      { "status.READY": "\n\n  Halo {{orderNumber}}  \n\n" },
    );
    expect(out.startsWith("Halo")).toBe(true);
    expect(out.endsWith("LD-001")).toBe(true);
  });

  it("does not interpret {{var}} as regex", () => {
    // Defensive: split/join instead of replace avoids regex special-char traps.
    const out = renderWhatsAppTemplate(
      "status.READY",
      { orderNumber: "LD-(001)" },
    );
    expect(out).toContain("LD-(001)");
  });
});

describe("renderWhatsAppTemplate — golden masters (defaults match pre-feature behavior)", () => {
  it("status.READY default matches verbatim", () => {
    const out = renderWhatsAppTemplate("status.READY", { orderNumber: "LD-001" });
    expect(out).toBe(
      "Halo, pakaian Anda untuk pesanan LD-001 sudah siap diambil. Terima kasih! - hivePOS",
    );
  });

  it("status.RECEIVED default matches verbatim", () => {
    const out = renderWhatsAppTemplate("status.RECEIVED", { orderNumber: "LD-001" });
    expect(out).toBe(
      "Halo, pesanan Anda LD-001 sedang kami proses. Terima kasih! - hivePOS",
    );
  });

  it("unpaid.reminder default matches verbatim", () => {
    const out = renderWhatsAppTemplate("unpaid.reminder", { orderNumber: "INV-42" });
    expect(out).toBe(
      "Halo, ini pengingat bahwa pesanan INV-42 belum lunas. Mohon untuk melakukan pembayaran. Terima kasih! - hivePOS",
    );
  });

  it("tenantSite.orderCta default matches verbatim", () => {
    const out = renderWhatsAppTemplate("tenantSite.orderCta", { tenantName: "Berkah Laundry" });
    expect(out).toBe(
      "Halo Berkah Laundry, saya mau pesan layanan laundry. Apakah bisa dibantu?",
    );
  });

  it("tenantSite.askCta default matches verbatim", () => {
    const out = renderWhatsAppTemplate("tenantSite.askCta", { tenantName: "Berkah Laundry" });
    expect(out).toBe(
      "Halo Berkah Laundry, saya mau tanya tentang layanan & harga. Terima kasih.",
    );
  });
});
