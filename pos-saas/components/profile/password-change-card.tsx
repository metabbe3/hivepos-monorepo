"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, Check, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { PasswordStrengthMeter, calcStrength } from "./password-strength-meter";

interface PasswordChangeCardProps {
  /** Called after a successful password change (e.g. parent may bump session). */
  onChanged?: () => void;
}

export function PasswordChangeCard({ onChanged }: PasswordChangeCardProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [show, setShow] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [saving, setSaving] = useState(false);

  const strength = calcStrength(form.newPassword);
  const hasConfirmMismatch =
    form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword;
  const confirmMatched =
    form.confirmPassword.length > 0 && form.newPassword === form.confirmPassword;

  const canSubmit =
    !saving &&
    form.currentPassword.length > 0 &&
    strength.score >= 2 &&
    form.newPassword === form.confirmPassword &&
    form.newPassword.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await apiFetch("/api/user/profile", {
        method: "PATCH",
        body: {
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        },
      });
      toast.success(t("profile.passwordUpdated"));
      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      onChanged?.();
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : t("profile.failedSave"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide">
              {t("profile.password")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {t("profile.passwordDesc")}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current password */}
          <div className="space-y-1.5">
            <Label htmlFor="current-password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("profile.currentPassword")}
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={show.current ? "text" : "password"}
                value={form.currentPassword}
                onChange={(e) =>
                  setForm({ ...form, currentPassword: e.target.value })
                }
                placeholder={t("profile.currentPasswordPlaceholder")}
                className="pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
                aria-label={
                  show.current
                    ? t("profile.hidePassword")
                    : t("profile.showPassword")
                }
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {show.current ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* New password + strength meter */}
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("profile.newPassword")}
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={show.next ? "text" : "password"}
                value={form.newPassword}
                onChange={(e) =>
                  setForm({ ...form, newPassword: e.target.value })
                }
                placeholder={t("profile.newPasswordPlaceholder")}
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, next: !s.next }))}
                aria-label={
                  show.next
                    ? t("profile.hidePassword")
                    : t("profile.showPassword")
                }
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {show.next ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {form.newPassword && (
              <div className="pt-1">
                <PasswordStrengthMeter password={form.newPassword} />
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("profile.confirmPassword")}
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={show.confirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
                placeholder={t("profile.confirmPasswordPlaceholder")}
                className={cn(
                  "pr-10",
                  hasConfirmMismatch &&
                    "border-red-500/60 focus-visible:ring-red-500/30",
                )}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() =>
                  setShow((s) => ({ ...s, confirm: !s.confirm }))
                }
                aria-label={
                  show.confirm
                    ? t("profile.hidePassword")
                    : t("profile.showPassword")
                }
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {show.confirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {hasConfirmMismatch && (
              <p className="flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                <AlertCircle className="h-3 w-3" />
                {t("profile.passwordsMismatch")}
              </p>
            )}
            {confirmMatched && (
              <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                {t("profile.passwordsMatch")}
              </p>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              disabled={!canSubmit}
              className="gap-1.5 shadow-sm transition-all hover:brightness-105"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {t("profile.updatePassword")}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
