"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiFetch, ApiClientError } from "@/modules/shared";
import type { FieldDef, FormSchema } from "./types";
import { useTranslation } from "@/hooks/use-translation";

// ─── Async Options Hook ──────────────────────────────────────
function useAsyncOptions(field: FieldDef) {
  const [options, setOptions] = React.useState(field.options ?? []);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!field.optionsEndpoint) return;
    let cancelled = false;
    setLoading(true);
    fetch(field.optionsEndpoint)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const data = json?.data ?? json;
        if (Array.isArray(data)) {
          setOptions(
            data.map((item: Record<string, unknown>) => ({
              label: String(item[field.optionsLabelKey ?? "name"] ?? item.name ?? item.id),
              value: String(item[field.optionsValueKey ?? "id"]),
            }))
          );
        } else if (data?.options) {
          setOptions(data.options);
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [field.optionsEndpoint]);

  return { options, loading };
}

// ─── Password Input with Toggle ──────────────────────────────
function PasswordInput({
  id,
  name,
  autocomplete,
  value,
  onChange,
  placeholder,
  disabled,
  error,
  touchTargets,
}: {
  id: string;
  name?: string;
  autocomplete?: string;
  value: unknown;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled: boolean;
  error?: string;
  touchTargets?: boolean;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        autoComplete={autocomplete}
        type={visible ? "text" : "password"}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        data-size={touchTargets ? "touch" : undefined}
        className={cn(error && "border-destructive", touchTargets && "pr-11")}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

// ─── Field Renderer ──────────────────────────────────────────
function FieldRenderer({
  field,
  value,
  error,
  onChange,
  onBlur,
  disabled,
  touchTargets,
  placeholder,
  label,
}: {
  field: FieldDef;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
  onBlur: () => void;
  disabled: boolean;
  touchTargets?: boolean;
  placeholder?: string;
  label?: string;
}) {
  const { options, loading } = useAsyncOptions(field);
  const dataSizeAttr = touchTargets ? "touch" : undefined;
  const inputId = field.name;

  // Custom render override — caller owns the markup, DynamicForm owns state.
  if (field.render) {
    return <>{field.render({ value, onChange, field, disabled })}</>;
  }

  const common = cn(
    "w-full",
    field.type === "currency" && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  );

  if (field.type === "password" && field.showPasswordToggle) {
    return (
      <PasswordInput
        id={inputId}
        name={field.name}
        autocomplete={field.autocomplete}
        value={value}
        onChange={(v) => onChange(v)}
        placeholder={placeholder}
        disabled={disabled}
        error={error}
        touchTargets={touchTargets}
      />
    );
  }

  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          id={inputId}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(common, error && "border-destructive", touchTargets && "min-h-11 px-4 py-2.5 rounded-xl")}
          rows={3}
        />
      );

    case "select":
      return (
        <Select
          value={String(value ?? "")}
          onValueChange={onChange}
          disabled={disabled || loading}
          items={options}
        >
          <SelectTrigger id={inputId} className={cn(error && "border-destructive", touchTargets && "h-11 px-4 rounded-xl")}>
            <SelectValue placeholder={placeholder ?? "Pilih..."} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "switch":
      return (
        <div className="flex items-center gap-3 pt-1">
          <Switch
            id={inputId}
            checked={Boolean(value)}
            onCheckedChange={onChange}
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground">
            {Boolean(value) ? "Aktif" : "Nonaktif"}
          </span>
        </div>
      );

    case "checkbox":
      return (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id={inputId}
            checked={Boolean(value)}
            onCheckedChange={(v) => onChange(Boolean(v))}
            disabled={disabled}
          />
          {label && (
            <Label htmlFor={inputId} className="text-sm font-medium cursor-pointer">
              {label}
            </Label>
          )}
        </div>
      );

    case "currency":
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
          <Input
            id={inputId}
            type="number"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            onBlur={onBlur}
            placeholder={placeholder ?? "0"}
            disabled={disabled}
            min={field.min}
            max={field.max}
            step={field.step ?? 0}
            data-size={dataSizeAttr}
            className={cn(common, "pl-9", error && "border-destructive")}
          />
        </div>
      );

    case "number":
      return (
        <Input
          id={inputId}
          type="number"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          data-size={dataSizeAttr}
          className={cn(common, error && "border-destructive")}
        />
      );

    case "date":
    case "datetime-local":
      return (
        <Input
          id={inputId}
          type={field.type}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          data-size={dataSizeAttr}
          className={cn(common, error && "border-destructive")}
        />
      );

    case "hidden":
      return null;

    default:
      return (
        <Input
          id={inputId}
          name={field.name}
          autoComplete={field.autocomplete}
          type={field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "password" ? "password" : "text"}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          pattern={field.pattern}
          data-size={dataSizeAttr}
          className={cn(common, error && "border-destructive")}
        />
      );
  }
}

// ─── Dynamic Form Component ──────────────────────────────────
export interface DynamicFormProps {
  schema: FormSchema;
  /** Existing record for edit mode (field values keyed by name) */
  initialData?: Record<string, unknown>;
  /** Override record ID for PATCH (if not in initialData) */
  recordId?: string;
  /** Extra static data to merge into payload */
  extraData?: Record<string, unknown>;
  /**
   * Custom submit handler. When provided, DynamicForm skips its built-in fetch
   * and calls this with the validated, transformed values. Use for flows that
   * can't be expressed as a simple POST/PATCH to `schema.apiEndpoint`
   * (e.g. next-auth signIn, chained calls).
   */
  onSubmit?: (values: Record<string, unknown>) => Promise<void>;
  /** Called on successful submit (built-in fetch path only) */
  onSuccess?: (data: Record<string, unknown>) => void;
  /** Called on cancel */
  onCancel?: () => void;
  /** Disable all fields */
  disabled?: boolean;
  /** Hide submit/cancel buttons (parent controls) */
  hideActions?: boolean;
  /** Custom submit label override */
  submitLabelOverride?: string;
  /** Class name for the form wrapper */
  className?: string;
  /**
   * Optional children rendered inside the <form>, after the field grid and
   * actions. Use this to inject custom submit buttons with intent-capturing
   * name/value pairs (set hideActions=true to replace the default button
   * entirely). Children's clicks still trigger the form's onSubmit, so
   * validation runs as normal.
   */
  children?: React.ReactNode;
}

const colSpanClass: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
};

const gridColsClass: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export function DynamicForm({
  schema,
  initialData,
  recordId,
  extraData,
  onSubmit,
  onSuccess,
  onCancel,
  disabled = false,
  hideActions = false,
  submitLabelOverride,
  className,
  children,
}: DynamicFormProps) {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const touchTargets = schema.touchTargets ?? false;

  // Resolve i18n-aware strings: try key, fall back to literal, fall back to default.
  // CRITICAL: if t(key) returns the key itself (unresolved — stale PWA bundle,
  // broken context, missing key), DON'T show the raw key — fall through to the
  // literal/fallback so the form is ALWAYS human-readable.
  const resolveText = (literal: string | undefined, key: string | undefined, fallback?: string): string | undefined => {
    if (key) {
      const resolved = t(key);
      if (resolved !== key) return resolved; // resolved → use it
      // unresolved → fall through to literal/fallback (NOT the raw key)
    }
    if (literal) return literal;
    return fallback;
  };

  // Translate a form-UI string with a hardcoded bilingual fallback. Same
  // self-healing logic: if t() can't resolve, use the hardcoded message.
  const tr = (key: string, id: string, en: string): string => {
    const resolved = t(key);
    return resolved === key ? (lang === "id" ? id : en) : resolved;
  };

  // Initialize values from defaults + initial data
  const [values, setValues] = React.useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of schema.fields) {
      v[f.name] = initialData?.[f.name] ?? f.defaultValue ?? (f.type === "checkbox" || f.type === "switch" ? false : f.type === "number" || f.type === "currency" ? "" : "");
    }
    return v;
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  // Update values when initialData changes
  React.useEffect(() => {
    if (initialData) {
      const v: Record<string, unknown> = {};
      for (const f of schema.fields) {
        v[f.name] = initialData?.[f.name] ?? f.defaultValue ?? v[f.name];
      }
      setValues((prev) => ({ ...v, ...prev, ...initialData }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialData)]);

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // onBlur validation: run this field's validate fn, set or clear its error.
  const handleBlur = (field: FieldDef) => {
    if (field.validate) {
      const err = field.validate(values[field.name], values);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next[field.name] = err;
        else delete next[field.name];
        return next;
      });
    }
  };

  const validateAll = (): boolean => {
    const e: Record<string, string> = {};
    for (const f of schema.fields) {
      if (f.hidden || f.type === "hidden") continue;
      if (f.condition && !f.condition(values)) continue;

      const val = values[f.name];

      // Required check
      if (f.required && (val === "" || val === undefined || val === null)) {
        const label = resolveText(f.label, f.labelKey, f.name) ?? f.name;
        e[f.name] = lang === "id" ? `${label} wajib diisi.` : `${label} is required.`;
        continue;
      }

      // Custom validate
      if (f.validate) {
        const err = f.validate(val, values);
        if (err) e[f.name] = err;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validateAll()) {
      toast.error(tr("form.checkForm", "Ada isian yang belum lengkap — cek lagi ya.", "Some fields still need filling."));
      return;
    }

    setSubmitting(true);
    try {
      // Transform values
      let payload = { ...values };
      if (schema.transform) {
        payload = schema.transform(payload);
      }

      // Custom submit — caller owns the whole flow.
      if (onSubmit) {
        await onSubmit(payload);
        return;
      }

      // Built-in fetch path
      const merged = { ...payload, ...(extraData ?? {}), ...(schema.extraData ?? {}) };
      const isEdit = recordId || initialData?.id;
      const url = isEdit ? `${schema.apiEndpoint}/${isEdit}` : schema.apiEndpoint;
      const method = schema.method ?? (isEdit ? "PATCH" : "POST");

      if (schema.useApiFetch === false) {
        // Legacy raw-fetch path for endpoints that don't return the standardized envelope.
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(merged),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const errorMsg = data.error
            ? typeof data.error === "string"
              ? data.error
              : data.error.message
            : data.message || `HTTP ${res.status}`;
          throw new Error(errorMsg);
        }
        const data = await res.json().catch(() => ({}));
        toast.success(schema.successMessage ?? (isEdit ? "Berhasil diperbarui" : "Berhasil dibuat"));
        onSuccess?.(data.data ?? data);
        router.refresh();
      } else {
        const { data } = await apiFetch<Record<string, unknown>>(url, { method, body: merged });
        toast.success(schema.successMessage ?? (isEdit ? "Berhasil diperbarui" : "Berhasil dibuat"));
        onSuccess?.(data);
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message);
      } else {
        toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const visibleFields = schema.fields.filter(
    (f) => !f.hidden && f.type !== "hidden" && (!f.condition || f.condition(values))
  );

  const gridCols = schema.layout?.columns ?? 2;
  const gapClass = schema.layout?.gap === "sm" ? "gap-3" : schema.layout?.gap === "lg" ? "gap-6" : "gap-4";

  const submitLabel = resolveText(
    submitLabelOverride ?? schema.submitLabel,
    schema.submitLabelKey,
    tr("form.submit", "Simpan", "Submit"),
  );
  const cancelLabel = resolveText(schema.cancelLabel, schema.cancelLabelKey, tr("form.cancel", "Batal", "Cancel"));

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      <div className={cn("grid", gridColsClass[gridCols], gapClass)}>
        {visibleFields.map((field) => {
          // Re-check condition at render time
          if (field.condition && !field.condition(values)) return null;

          const span = field.colSpan ?? gridCols;
          const label = resolveText(field.label, field.labelKey, field.name);
          const placeholder = resolveText(field.placeholder, field.placeholderKey);
          const hint = resolveText(field.hint, field.hintKey);

          return (
            <div key={field.name} className={cn("space-y-1.5", colSpanClass[span])}>
              {field.type !== "checkbox" && field.type !== "switch" && (
                <Label htmlFor={field.name} className="text-sm font-medium">
                  {label}
                  {field.required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
              )}
              <FieldRenderer
                field={field}
                value={values[field.name]}
                error={errors[field.name]}
                onChange={(v) => handleChange(field.name, v)}
                onBlur={() => handleBlur(field)}
                disabled={disabled || submitting}
                touchTargets={touchTargets}
                placeholder={placeholder}
                label={label}
              />
              {hint && !errors[field.name] && (
                <p className="text-xs text-muted-foreground">{hint}</p>
              )}
              {errors[field.name] && (
                <p role="alert" className="text-xs text-destructive">{errors[field.name]}</p>
              )}
            </div>
          );
        })}
      </div>

      {!hideActions && (
        schema.submitFullWidth ? (
          <div className="pt-2">
            <Button type="submit" loading={submitting} disabled={disabled} size={touchTargets ? "touch" : "default"} className="w-full">
              {submitting ? tr("form.saving", "Menyimpan…", "Saving…") : submitLabel}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={submitting} disabled={disabled} size={touchTargets ? "touch" : "default"}>
              {submitting
                ? tr("form.saving", "Menyimpan…", "Saving…")
                : (
                  <>
                    {recordId || initialData?.id ? <Save className="size-4" /> : <Plus className="size-4" />}
                    {submitLabel}
                  </>
                )}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} size={touchTargets ? "touch" : "default"}>
                <X className="size-4" />
                {cancelLabel}
              </Button>
            )}
          </div>
        )
      )}

      {children}
    </form>
  );
}
