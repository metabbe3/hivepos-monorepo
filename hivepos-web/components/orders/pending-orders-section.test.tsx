// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PendingOrderRow } from "@/lib/offline/db";
import type { SyncStatus } from "@/lib/offline/use-sync-status";

// --- mocks (the section composes many hooks; isolate the gating + render) ---
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => ({ t: (k: string) => k, lang: "en", setLang: vi.fn() }),
}));
let flagValue = true;
vi.mock("@/hooks/use-feature-flag", () => ({
  useFeatureFlag: () => flagValue,
}));
vi.mock("@/lib/offline/use-online-status", () => ({
  useOnlineStatus: () => true,
}));
let syncStatus: SyncStatus = { pendingCount: 0, errorCount: 0, draining: false };
vi.mock("@/lib/offline/use-sync-status", () => ({
  useSyncStatus: () => syncStatus,
}));
let pendingRows: PendingOrderRow[] = [];
vi.mock("@/lib/offline/db", () => ({
  listPendingOrders: async () => pendingRows,
  deletePendingOrder: vi.fn(),
}));
vi.mock("@/lib/offline/sync-engine", () => ({ drainOutbox: vi.fn() }));
vi.mock("@/lib/offline/client-id", () => ({ shortPendingId: (id: string) => `PENDING-${id.slice(0, 4)}` }));
vi.mock("@/components/shared/confirm-dialog", () => ({ useConfirm: () => async () => true }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PendingOrdersSection } from "./pending-orders-section";

const row = (over: Partial<PendingOrderRow> = {}): PendingOrderRow => ({
  clientId: "abc123def456",
  status: "pending",
  payload: { items: [] },
  pricedItems: [{ serviceName: "Cuci Setrika", quantity: 0, weightKg: 2, pricePerUnit: 7000, subtotal: 14000 }],
  totalAmount: 14000,
  discountAmount: 0,
  branchId: "b1",
  module: "LAUNDRY",
  createdAt: new Date().toISOString(),
  ...over,
});

describe("PendingOrdersSection", () => {
  beforeEach(() => {
    flagValue = true;
    syncStatus = { pendingCount: 0, errorCount: 0, draining: false };
    pendingRows = [];
  });

  it("renders nothing when the flag is OFF (AC-7)", () => {
    flagValue = false;
    pendingRows = [row()];
    const { container } = render(<PendingOrdersSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when flag ON but there are no active rows", () => {
    pendingRows = [row({ status: "synced" })]; // synced rows are hidden
    const { container } = render(<PendingOrdersSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the pending id + total when flag ON and rows exist (AC-2)", async () => {
    pendingRows = [row()];
    render(<PendingOrdersSection />);
    // listPendingOrders is async — findByText waits for the post-load re-render.
    expect(await screen.findByText(/PENDING-abc1/)).toBeInTheDocument();
    expect(screen.getByText("offline.statusPending")).toBeInTheDocument();
    expect(screen.getByText(/Cuci Setrika/)).toBeInTheDocument();
  });

  it("shows lastError on an errored row", async () => {
    pendingRows = [row({ status: "error", lastError: "server 500" })];
    render(<PendingOrdersSection />);
    expect(await screen.findByText("server 500")).toBeInTheDocument();
    expect(screen.getByText("offline.statusError")).toBeInTheDocument();
  });
});
