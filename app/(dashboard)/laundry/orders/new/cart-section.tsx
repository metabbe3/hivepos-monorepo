"use client";

import { Loader2, Minus, Plus, Clock, Trash2, UserPlus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { GarmentBreakdownEditor } from "@/components/pos/garment-breakdown-editor";
import { useTranslation } from "@/hooks/use-translation";
import { useNewOrder } from "./new-order-context";

export function CartSection() {
  const {
    items,
    setItems,
    selectedCustomer,
    subtotal,
    total,
    totalPcs,
    changeAmount,
    fastCashOptions,
    discountMode,
    setDiscountMode,
    discountValue,
    setDiscountValue,
    discountCalculated,
    paymentMethod,
    setPaymentMethod,
    cashReceived,
    setCashReceived,
    orderNotes,
    setOrderNotes,
    submitting,
    handleSubmit,
    calcSubtotal,
    updateItem,
    removeItem,
  } = useNewOrder();
  const { t } = useTranslation();

  return (
    <>
      {/* Cart / Order Items */}
      {items.length > 0 && (
        <Card className="border border-border/40 bg-card shadow-sm rounded-xl">
          <CardHeader><CardTitle className="text-base font-semibold">{t("newOrder.orderItems")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, idx) => (
              <CartItemRow
                key={idx}
                index={idx}
                item={item}
                calcSubtotal={calcSubtotal}
                updateItem={updateItem}
                removeItem={removeItem}
                setItems={setItems}
                items={items}
              />
            ))}

            {/* Price Breakdown */}
            <div className="space-y-2 rounded-xl bg-gradient-to-r from-primary/8 to-primary/4 dark:from-primary/5 dark:to-primary/3 p-4 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("orderDetails.subtotal")}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountCalculated > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("orderDetails.discount")}
                    {discountMode === "percentage" && discountValue ? ` (${discountValue}%)` : ""}
                    {discountMode === "fixed" ? ` ${t("orderDetails.fixed")}` : ""}
                  </span>
                  <span className="text-red-600">-{formatCurrency(discountCalculated)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-base">{t("common.total")}</span>
                <span className="text-2xl font-bold">{formatCurrency(total)}</span>
              </div>
              {totalPcs > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("garment.totalItems").replace("{count}", String(totalPcs))}</span>
                  <span />
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            {selectedCustomer && (
              <div className="space-y-3 mt-2">
                <details>
                  <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground list-none">
                    {t("newOrder.payment")}: {paymentMethod === "PAY_LATER" ? t("newOrder.payLater") : paymentMethod === "CASH" ? t("paymentMethod.cash") : paymentMethod === "QRIS" ? t("paymentMethod.qris") : paymentMethod === "TRANSFER" ? t("paymentMethod.transfer") : t("paymentMethod.deposit")}
                  </summary>
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {([
                    { key: "PAY_LATER" as const, label: t("newOrder.payLater"), icon: <Clock className="h-4 w-4" /> },
                    { key: "CASH" as const, label: t("paymentMethod.cash"), icon: <span className="text-sm font-bold">Rp</span> },
                    { key: "DEPOSIT" as const, label: t("paymentMethod.deposit"), icon: <User className="h-4 w-4" /> },
                    { key: "QRIS" as const, label: t("paymentMethod.qris"), icon: <span className="text-sm font-bold">QR</span> },
                    { key: "TRANSFER" as const, label: t("paymentMethod.transfer"), icon: <span className="text-sm font-bold">TF</span> },
                  ]).map((pm) => (
                    <button
                      key={pm.key}
                      type="button"
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-xs font-semibold transition-all ${
                        paymentMethod === pm.key
                          ? "border-border bg-background text-foreground shadow-sm ring-1 ring-ring/20"
                          : "border-border/40 bg-card hover:border-border/80 hover:bg-muted/30"
                      }`}
                      onClick={() => setPaymentMethod(pm.key)}
                    >
                      <span className="h-4 flex items-center justify-center">{pm.icon}</span>
                      <span>{pm.label}</span>
                    </button>
                  ))}
                </div>
                </details>

                {paymentMethod === "PAY_LATER" && (
                  <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                    {t("newOrder.payLaterNote")}
                  </p>
                )}

                {paymentMethod === "CASH" && fastCashOptions.length > 0 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {fastCashOptions.map((opt) => (
                        <button
                          key={opt.amount}
                          type="button"
                          className={`rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all ${
                            cashReceived === opt.amount
                              ? "border-border bg-background text-foreground shadow-sm ring-1 ring-ring/20"
                              : "border-border/40 bg-card hover:border-border/80"
                          }`}
                          onClick={() => setCashReceived(opt.amount)}
                        >
                          {opt.isExact ? t("newOrder.exactAmount") : opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">{t("newOrder.customAmount")}</Label>
                      <Input
                        type="number"
                        placeholder="Rp"
                        value={cashReceived && !fastCashOptions.some((o) => o.amount === cashReceived) ? cashReceived : ""}
                        onChange={(e) => setCashReceived(e.target.value ? parseFloat(e.target.value) : null)}
                        className="h-9 text-sm bg-muted/30 border-border/30 rounded-lg"
                      />
                    </div>
                    {cashReceived !== null && cashReceived >= total && (
                      <div className="flex justify-between items-center rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                        <span className="text-sm font-medium text-emerald-700">{t("newOrder.changeDue")}</span>
                        <span className="text-lg font-bold text-emerald-700">{formatCurrency(changeAmount)}</span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === "DEPOSIT" && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center rounded-xl border px-4 py-3 bg-emerald-50/50 border-emerald-200">
                      <span className="text-sm text-emerald-700">{t("newOrder.depositBalance")}</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(selectedCustomer.balance || 0)}</span>
                    </div>
                    {(selectedCustomer.balance || 0) >= total ? (
                      <div className="flex justify-between items-center rounded-xl border px-4 py-2.5 bg-sky-50/50 border-sky-200">
                        <span className="text-sm text-sky-700">{t("newOrder.balanceAfter")}</span>
                        <span className="font-semibold text-sky-700">{formatCurrency((selectedCustomer.balance || 0) - total)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl border px-4 py-3 bg-red-50 border-red-200">
                        <span className="text-sm font-medium text-red-600">{t("newOrder.insufficientBalance")}</span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === "QRIS" && (
                  <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                    {t("newOrder.qrisNote")}
                  </p>
                )}

                {paymentMethod === "TRANSFER" && (
                  <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                    {t("newOrder.transferNote")}
                  </p>
                )}
              </div>
            )}

            {items.length > 0 && !selectedCustomer && (
              <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/50 px-4 py-4 text-sm text-sky-700">
                <UserPlus className="h-4 w-4" />
                <span>{t("newOrder.assignCustomer")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Discount — folded into cart flow (top-border separator, no separate card) */}
      {items.length > 0 && (
        <div className="border-t border-border/40 pt-4 space-y-4">
          <span className="text-sm font-semibold text-muted-foreground">{t("newOrder.discount")}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  discountMode === "none"
                    ? "border-border bg-background text-foreground shadow-sm"
                    : "border-border/40 hover:bg-muted/30 text-muted-foreground"
                }`}
                onClick={() => { setDiscountMode("none"); setDiscountValue(""); }}
              >
                {t("newOrder.noDiscount")}
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  discountMode === "percentage"
                    ? "border-border bg-background text-foreground shadow-sm"
                    : "border-border/40 hover:bg-muted/30 text-muted-foreground"
                }`}
                onClick={() => { setDiscountMode("percentage"); setDiscountValue(""); }}
              >
                {t("newOrder.percentage")}
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  discountMode === "fixed"
                    ? "border-border bg-background text-foreground shadow-sm"
                    : "border-border/40 hover:bg-muted/30 text-muted-foreground"
                }`}
                onClick={() => { setDiscountMode("fixed"); setDiscountValue(""); }}
              >
                {t("newOrder.fixedAmount")}
              </button>
            </div>
            {discountMode === "percentage" && (
              <div className="space-y-1">
                <Label className="text-xs">{t("newOrder.discountPercentage")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="max-w-full sm:max-w-[120px] bg-muted/30 border-border/30 rounded-lg"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            )}
            {discountMode === "fixed" && (
              <div className="space-y-1">
                <Label className="text-xs">{t("newOrder.discountAmount")}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rp</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="max-w-full sm:max-w-[200px] bg-muted/30 border-border/30 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
      )}

      {/* Notes & Submit */}
      <Card className="border border-border/40 bg-card shadow-sm rounded-xl">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>{t("common.notes")}</Label>
            <Textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder={t("newOrder.anyNotes")} className="bg-muted/30 border-border/30 rounded-xl" />
          </div>

          <Button
            type="submit"
            onClick={handleSubmit}
            className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/15 transition-all hover:shadow-lg hover:brightness-105 text-white font-semibold"
            size="lg"
            disabled={submitting || !selectedCustomer || items.length === 0 || (paymentMethod === "DEPOSIT" && (selectedCustomer?.balance || 0) < total)}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {selectedCustomer ? `${t("newOrder.completePayment")} — ${formatCurrency(total)}` : `${t("orders.createOrder")} — ${formatCurrency(total)}`}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

interface CartItemRowProps {
  index: number;
  item: import("./new-order-context").LineItem;
  items: import("./new-order-context").LineItem[];
  calcSubtotal: (item: import("./new-order-context").LineItem) => number;
  updateItem: (index: number, field: keyof import("./new-order-context").LineItem, value: string) => void;
  removeItem: (index: number) => void;
  setItems: React.Dispatch<React.SetStateAction<import("./new-order-context").LineItem[]>>;
}

function CartItemRow({ index, item, items, calcSubtotal, updateItem, removeItem, setItems }: CartItemRowProps) {
  const { t } = useTranslation();
  const { getService } = useNewOrder();
  const svc = getService(item.serviceId);
  if (!svc) return null;

  return (
    <div
      className={`flex items-start sm:items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3 ${
        svc.pricingType === "PER_KG" ? "border-border/60" : "border-border/40"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-sm truncate">{svc.name}</p>
          {svc.pricingType === "PER_KG" && (
            <span className="shrink-0 rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/20 dark:bg-brand-light/10">
              {t("garment.kiloan")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          {svc.pricingType === "PER_KG" ? (
            <>
              <button
                type="button"
                className="h-11 w-11 sm:h-9 sm:w-9 rounded-full border border-border/30 flex items-center justify-center hover:bg-accent/60 transition-colors"
                onClick={() => {
                  const val = Math.max(0, (parseFloat(item.weightKg) || 0) - 0.5);
                  updateItem(index, "weightKg", val > 0 ? val.toFixed(1) : "");
                }}
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                step="0.1"
                className="w-18 rounded-lg border border-border/30 px-2 py-1.5 text-sm text-center bg-transparent font-semibold"
                value={item.weightKg}
                onChange={(e) => updateItem(index, "weightKg", e.target.value)}
                placeholder="0.0"
                autoFocus
              />
              <button
                type="button"
                className="h-11 w-11 sm:h-9 sm:w-9 rounded-full border border-border/30 flex items-center justify-center hover:bg-accent/60 transition-colors"
                onClick={() => {
                  const val = (parseFloat(item.weightKg) || 0) + 0.5;
                  updateItem(index, "weightKg", val.toFixed(1));
                }}
              >
                <Plus className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground ml-1">{t("newOrder.kg")}</span>
            </>
          ) : (
            <>
              <button
                type="button"
                className="h-11 w-11 sm:h-9 sm:w-9 rounded-full border border-border/30 flex items-center justify-center hover:bg-accent/60 transition-colors"
                onClick={() => {
                  const val = Math.max(1, (parseInt(item.quantity) || 1) - 1);
                  updateItem(index, "quantity", String(val));
                }}
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                className="w-16 rounded-lg border border-border/30 px-2 py-1.5 text-sm text-center bg-transparent font-semibold"
                value={item.quantity}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
              />
              <button
                type="button"
                className="h-11 w-11 sm:h-9 sm:w-9 rounded-full border border-border/30 flex items-center justify-center hover:bg-accent/60 transition-colors"
                onClick={() => {
                  const val = (parseInt(item.quantity) || 0) + 1;
                  updateItem(index, "quantity", String(val));
                }}
              >
                <Plus className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground ml-1">{t("orders.items")}</span>
            </>
          )}
        </div>
        {svc.pricingType === "PER_KG" && (
          <GarmentBreakdownEditor
            value={items[index].garmentBreakdown || []}
            onChange={(newBreakdown) => {
              setItems((prev) => {
                const updated = [...prev];
                updated[index] = { ...updated[index], garmentBreakdown: newBreakdown };
                return updated;
              });
            }}
          />
        )}
      </div>
      <span className="font-bold text-sm whitespace-nowrap mt-1">
        {formatCurrency(calcSubtotal(item))}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        onClick={() => removeItem(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
