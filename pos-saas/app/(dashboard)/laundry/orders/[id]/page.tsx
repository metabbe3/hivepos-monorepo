"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ORDER_STATUS_CONFIG, ORDER_STATUS_FLOW } from "@/lib/constants";
import { PageLoading } from "@/components/shared/loading";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { formatCurrency } from "@/lib/format";
import { renderWhatsAppTemplate } from "@/lib/whatsapp-templates";
import { useWhatsappTemplates } from "@/hooks/use-whatsapp-templates";
import { BackButton } from "@/components/shared/back-button";
import type { OrderDetail, PayFormState } from "@/components/orders/order-types";
import { OrderDetailHeader } from "@/components/orders/order-detail-header";
import { OrderStatusTimeline } from "@/components/orders/order-status-timeline";
import { OrderItemsTable } from "@/components/orders/order-items-table";
import { OrderPriceSummary } from "@/components/orders/order-price-summary";
import { OrderPaymentCard } from "@/components/orders/order-payment-card";
import { OrderCustomerCard } from "@/components/orders/order-customer-card";
import { OrderPhotoSection } from "@/components/orders/order-photo-section";
import { OrderPaymentsLog } from "@/components/orders/order-payments-log";
import { OrderPaymentDialog } from "@/components/orders/order-payment-dialog";
import { OrderEditForm } from "@/components/orders/order-edit-form";

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const whatsappTemplates = useWhatsappTemplates();
  const { isEmployee } = useRole();
  const { t } = useTranslation();
  const confirm = useConfirm();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payForm, setPayForm] = useState<PayFormState>({
    amount: "",
    paymentMethod: "QRIS",
    notes: "",
    paidAt: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    params.then(({ id }) => {
      apiFetch<OrderDetail>(`/api/orders/${id}`)
        .then((res) => setOrder(res.data))
        .catch(() => {
          // leave order null; loading cleared below
        })
        .finally(() => setLoading(false));
    });
  }, [params]);

  // Auto-enter edit mode from ?edit=true
  useEffect(() => {
    if (
      order &&
      searchParams.get("edit") === "true" &&
      !editMode &&
      !isEmployee &&
      order.status !== "DELIVERED"
    ) {
      setEditMode(true);
    }
  }, [order, searchParams, editMode, isEmployee]);

  async function updateStatus(newStatus: string) {
    if (!order) return;
    try {
      const result = await apiFetch<Partial<OrderDetail>>(
        `/api/orders/${order.id}/status`,
        { method: "PATCH", body: { status: newStatus } },
      );
      setOrder({ ...order, ...result.data });
      toast.success(
        `Status updated to ${t(ORDER_STATUS_CONFIG[newStatus as keyof typeof ORDER_STATUS_CONFIG].labelKey)}`,
      );
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : t("orders.failedUpdate"),
      );
    }
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    try {
      await apiFetch(`/api/orders/${order.id}/payments`, {
        method: "POST",
        body: {
          amount: parseFloat(payForm.amount),
          paymentMethod: payForm.paymentMethod,
          notes: payForm.notes || undefined,
          paidAt: payForm.paidAt || undefined,
        },
      });
      toast.success(t("orderDetails.paymentRecorded"));
      setPayDialogOpen(false);
      setPayForm({
        amount: "",
        paymentMethod: "QRIS",
        notes: "",
        paidAt: new Date().toISOString().slice(0, 10),
      });
      const refetched = await apiFetch<OrderDetail>(`/api/orders/${order.id}`);
      setOrder(refetched.data);
    } catch (err) {
      const errMsg = err instanceof ApiClientError ? err.message : "";
      const errorMsg = errMsg.toLowerCase().includes("wallet balance")
        ? t("deposit.insufficientBalance")
        : errMsg || t("orderDetails.failedRecord");
      toast.error(errorMsg);
    }
  }

  async function deleteOrder() {
    if (!order) return;
    if (
      !(await confirm({
        title: t("orders.deleteOrder"),
        description: t("orders.deleteConfirm").replace("{number}", order.orderNumber),
        destructive: true,
      }))
    )
      return;
    try {
      await apiFetch(`/api/orders/${order.id}`, { method: "DELETE" });
      toast.success(t("orders.deleted"));
      router.push("/laundry/orders");
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : t("orders.failedDelete"),
      );
    }
  }

  function shareTrackingLink() {
    if (!order) return;
    const trackingUrl = `${window.location.origin}/track/${order.orderNumber}`;
    const phone = order.customerPhone ?? "";
    const message = renderWhatsAppTemplate(
      "order.trackingShare",
      {
        customerName: order.customerName,
        trackingUrl,
        totalAmount: formatCurrency(order.totalAmount - order.discountAmount),
        statusLabel: t(ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG].labelKey),
      },
      whatsappTemplates,
    );
    const waUrl = `https://wa.me/${phone.startsWith("0") ? "62" + phone.slice(1) : phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
    toast.success("Link tracking dikirim via WhatsApp");
  }

  async function handleEditSave(payload: {
    customerId: string;
    notes?: string;
    receivedAt?: string;
    items: Array<{
      serviceId: string;
      quantity: number;
      weightKg?: number;
      garmentBreakdown?: { name: string; qty: number }[];
    }>;
    discountType?: "PERCENTAGE" | "FIXED";
    discountAmount?: number;
  }) {
    if (!order) return;
    try {
      const result = await apiFetch<OrderDetail>(`/api/orders/${order.id}`, {
        method: "PUT",
        body: payload as unknown as Record<string, unknown>,
      });
      setOrder(result.data);
      setEditMode(false);
      toast.success(t("orders.updateSuccess"));
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : t("orders.failedUpdateOrder"),
      );
      throw err;
    }
  }

  if (loading) return <PageLoading />;
  if (!order)
    return (
      <p className="text-center py-12 text-muted-foreground">
        {t("orderDetails.orderNotFound")}
      </p>
    );

  // Status-advance callback
  const currentStatusIdx = ORDER_STATUS_FLOW.indexOf(order.status);
  const nextStatus =
    currentStatusIdx < ORDER_STATUS_FLOW.length - 1
      ? ORDER_STATUS_FLOW[currentStatusIdx + 1]
      : null;

  const itemsSubtotal = order.orderItems.reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );
  const totalPcs = order.orderItems.reduce((sum, item) => {
    if (item.weightKg) return sum;
    return (
      sum +
      (item.garmentBreakdown?.reduce((s, g) => s + g.qty, 0) || item.quantity)
    );
  }, 0);

  // ===== Edit mode: full-width form =====
  if (editMode) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <OrderDetailHeader
          order={order}
          isEmployee={isEmployee}
          editMode
          onShare={shareTrackingLink}
          onEdit={() => setEditMode(true)}
          onDelete={deleteOrder}
          onAdvanceStatus={() => nextStatus && updateStatus(nextStatus)}
          onPay={() => setPayDialogOpen(true)}
          onCancelEdit={() => setEditMode(false)}
        />
        <OrderEditForm
          order={order}
          onSave={handleEditSave}
          onCancel={() => setEditMode(false)}
        />
      </div>
    );
  }

  // ===== View mode =====
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackButton />
      <OrderDetailHeader
        order={order}
        isEmployee={isEmployee}
        editMode={false}
        onShare={shareTrackingLink}
        onEdit={() => setEditMode(true)}
        onDelete={deleteOrder}
        onAdvanceStatus={() => nextStatus && updateStatus(nextStatus)}
        onPay={() => setPayDialogOpen(true)}
        onCancelEdit={() => setEditMode(false)}
      />

      <OrderStatusTimeline order={order} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          <OrderItemsTable items={order.orderItems} totalPcs={totalPcs} />
          <OrderPriceSummary
            itemsSubtotal={itemsSubtotal}
            discountAmount={order.discountAmount}
            discountType={order.discountType}
            totalAmount={order.totalAmount}
          />
          {order.notes && (
            <Card className="rounded-xl border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {t("common.notes")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
              </CardContent>
            </Card>
          )}
          <OrderPhotoSection orderId={order.id} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-6 self-start">
          {!isEmployee && (
            <OrderPaymentCard
              order={order}
              isEmployee={isEmployee}
              onPay={() => setPayDialogOpen(true)}
            />
          )}
          <OrderCustomerCard order={order} />
          {!isEmployee && order.payments.length > 0 && (
            <OrderPaymentsLog payments={order.payments} />
          )}
        </div>
      </div>

      {!isEmployee && (
        <OrderPaymentDialog
          open={payDialogOpen}
          onOpenChange={setPayDialogOpen}
          order={order}
          form={payForm}
          onFormChange={setPayForm}
          onSubmit={handlePayment}
        />
      )}
    </div>
  );
}
