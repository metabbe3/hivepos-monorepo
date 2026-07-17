"use client";

// ponytail: ad-hoc form (not on DynamicForm). ceiling: uses inline canSave check + profile.* i18n keys
// instead of canonical validation.required + form.checkForm. upgrade: migrate this card, password-change-card,
// laundry/orders/new, laundry/orders/[id], billing, branches/[id] together when DynamicForm supports inline
// strength meters / password reveal / dynamic line items. See PONYTAIL-DEBT.md. **no-trigger**

import { useEffect, useState } from "react";
import { User, Lock, Save, Loader2, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch, ApiClientError } from "@/modules/shared";

interface PersonalInfoCardProps {
  name: string;
  phone: string;
  email: string;
  /** Called after a successful save with the new name + phone. */
  onSaved: (name: string, phone: string) => void;
}

export function PersonalInfoCard({
  name,
  phone,
  email,
  onSaved,
}: PersonalInfoCardProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name, phone });
  const [saving, setSaving] = useState(false);

  // Sync local form when upstream profile changes (e.g. after session refresh).
  useEffect(() => {
    setForm({ name, phone });
  }, [name, phone]);

  const isDirty = form.name !== name || form.phone !== phone;
  const canSave = isDirty && form.name.trim().length > 0 && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await apiFetch("/api/user/profile", {
        method: "PATCH",
        body: { name: form.name, phone: form.phone },
      });
      toast.success(t("profile.profileUpdated"));
      onSaved(form.name, form.phone);
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
            <User className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide">
              {t("profile.personalInfo")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {t("profile.personalInfoDesc")}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("profile.fullName")}
            </Label>
            <Input
              id="profile-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-phone" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("profile.phone")}
            </Label>
            <Input
              id="profile-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder={t("profile.phonePlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("common.email")}
            </Label>
            <div className="relative">
              <Input
                id="profile-email"
                value={email}
                disabled
                className="bg-muted/50 pr-9"
              />
              <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Mail className="h-3 w-3" />
              {t("profile.emailLocked")}
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              disabled={!canSave}
              className={cn(
                "gap-1.5 bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/15 transition-all hover:brightness-105 hover:shadow-lg",
                !canSave && "opacity-50",
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t("common.save")}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
