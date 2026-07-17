import { prisma } from "@/lib/prisma";
import { getBranchFilter } from "@/lib/branch-context";
import { buildReceipt, sendToPrinter } from "@/lib/escpos";
import { BUSINESS_NAME_KEY } from "@/lib/constants";
import {
  withErrorHandler,
  apiSuccess,
  ValidationError,
  NotFoundError,
  InternalError,
  UnauthenticatedError,
} from "@/modules/shared";

export const POST = withErrorHandler(async (req: Request) => {
  const bf = await getBranchFilter();
  if (bf.error) throw new UnauthenticatedError();
  const { branchId, tenantId } = bf;

  // Look up printer config from database (with env var fallback)
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      name: true,
      printerHost: true,
      printerPort: true,
      printerEnabled: true,
      printerPaperSize: true,
    },
  });

  const PRINTER_HOST = branch?.printerHost || process.env.THERMAL_PRINTER_HOST || "";
  const PRINTER_PORT = branch?.printerPort || parseInt(process.env.THERMAL_PRINTER_PORT || "9100", 10);

  if (!PRINTER_HOST) {
    throw new InternalError("Printer not configured. Go to Branch Settings to configure your printer.");
  }

  const body = await req.json();
  const orderId = String(body.orderId || "").trim();
  if (!orderId || orderId.length < 10) {
    throw new ValidationError("Valid orderId is required");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId, branchId },
    include: {
      customer: { select: { name: true, phone: true } },
      orderItems: { include: { service: true } },
      branch: { select: { name: true } },
    },
  });

  if (!order) {
    throw new NotFoundError("Order", orderId);
  }

  const businessName = order.branch?.name ?? BUSINESS_NAME_KEY;

  const data = buildReceipt({
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: Number(order.totalAmount),
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    customer: { name: order.customer.name, phone: order.customer.phone ?? ""},
    orderItems: order.orderItems.map((i) => ({
      quantity: Number(i.quantity),
      weightKg: i.weightKg ? Number(i.weightKg) : null,
      subtotal: Number(i.subtotal),
      service: { name: i.service.name, pricingType: i.service.pricingType },
      garmentBreakdown: (i.garmentBreakdown as { name: string; qty: number }[] | null) ?? null,
    })),
    branch: { name: order.branch?.name ?? null },
  }, businessName, branch?.printerPaperSize ?? undefined);

  // ponytail: server-side print telemetry write — richer than client roundtrip
  // for network prints and survives ad blockers. Client handles bluetooth/usb/browser.
  const userId = bf.session.user.id;
  const printT0 = performance.now();
  try {
    await sendToPrinter(data, PRINTER_HOST, PRINTER_PORT);

    // Update last-seen timestamp on success
    await prisma.branch.update({
      where: { id: branchId },
      data: { printerLastSeen: new Date() },
    });

    await prisma.telemetryEvent.create({
      data: {
        tenantId,
        userId,
        kind: "print",
        payload: { ok: true, ms: Math.round(performance.now() - printT0), kind: "network", orderId },
      },
    });

    return apiSuccess({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Print failed";
    await prisma.telemetryEvent.create({
      data: {
        tenantId,
        userId,
        kind: "print",
        payload: { ok: false, ms: Math.round(performance.now() - printT0), kind: "network", orderId, error: message },
      },
    });
    throw new InternalError(message, { cause: err });
  }
});
