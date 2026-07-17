"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useTranslation } from "@/hooks/use-translation";
import { invalidateWhatsappTemplatesCache } from "@/hooks/use-whatsapp-templates";
import { TemplateEditor } from "@/components/settings/template-editor";
import {
  WHATSAPP_TEMPLATES,
  type TemplateId,
  type TemplateCategory,
  type TemplateManifestEntry,
  type TemplateOverrides,
} from "@/lib/whatsapp-templates";

interface ApiResponse {
  overrides: TemplateOverrides;
  defaults: Record<TemplateId, string>;
  effective: Record<TemplateId, string>;
  manifest: TemplateManifestEntry[];
}

// ponytail: static copy of manifest for category grouping. Categories: Orders,
// Status, Payments, Public. Render order matches WHATSAPP_TEMPLATES array.
const CATEGORY_ORDER: TemplateCategory[] = ["Orders", "Status", "Payments", "Public"];

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  Orders: "Pesanan",
  Status: "Status",
  Payments: "Pembayaran",
  Public: "Publik",
};

export default function WhatsappTemplatesPage() {
  const { t } = useTranslation();
  const [manifest] = useState<TemplateManifestEntry[]>(WHATSAPP_TEMPLATES);
  const [defaults, setDefaults] = useState<Record<TemplateId, string>>(
    {} as Record<TemplateId, string>,
  );
  // Form state: one string per template id. Initialized from `effective`.
  const [values, setValues] = useState<Record<TemplateId, string>>(
    {} as Record<TemplateId, string>,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<ApiResponse>("/api/tenant/whatsapp-templates")
      .then((r) => {
        setDefaults(r.data.defaults);
        setValues({ ...r.data.effective });
      })
      .catch((err) => {
        if (err instanceof ApiClientError) toast.error(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // ponytail: send full set — anything matching default OR empty becomes ""
      // (server deletes the key → falls back to default at render time).
      const payload: Partial<Record<TemplateId, string>> = {};
      for (const tpl of manifest) {
        const v = (values[tpl.id] ?? "").trim();
        if (!v || v === tpl.defaultBody.trim()) {
          payload[tpl.id] = "";
        } else {
          payload[tpl.id] = values[tpl.id];
        }
      }
      const r = await apiFetch<{ overrides: TemplateOverrides; effective: Record<TemplateId, string> }>(
        "/api/tenant/whatsapp-templates",
        { method: "PATCH", body: payload as unknown as Record<string, unknown> },
      );
      setValues({ ...r.data.effective });
      invalidateWhatsappTemplatesCache();
      toast.success("Template WhatsApp berhasil diperbarui.");
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.whatsappTemplates")}
        description="Kustomisasi pesan WhatsApp yang terisi otomatis di pesanan, kanban, pickup, dan halaman publik."
      />

      <form onSubmit={handleSave} className="space-y-4">
        {CATEGORY_ORDER.map((cat) => {
          const entries = manifest.filter((m) => m.category === cat);
          if (entries.length === 0) return null;
          return (
            <Card key={cat}>
              <CardHeader>
                <CardTitle>{CATEGORY_LABEL[cat]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {entries.map((tpl) => (
                  <TemplateEditor
                    key={tpl.id}
                    template={tpl}
                    value={values[tpl.id] ?? defaults[tpl.id] ?? ""}
                    onChange={(next) =>
                      setValues((prev) => ({ ...prev, [tpl.id]: next }))
                    }
                    onReset={() =>
                      setValues((prev) => ({ ...prev, [tpl.id]: tpl.defaultBody }))
                    }
                  />
                ))}
              </CardContent>
            </Card>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan"
            )}
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            Perubahan live dalam ~60 detik (cache TTL).
          </p>
        </div>
      </form>
    </div>
  );
}
