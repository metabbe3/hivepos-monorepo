"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Form field wrapper that standardizes the muted-card grouping used across
 * dashboard forms (branches, billing, services, profile, etc.).
 *
 * Renders a Label + arbitrary input/textarea/select children inside a
 * consistent `rounded-lg bg-muted/30 border border-border/30 p-3 space-y-1.5`
 * container. An optional error or hint line can be rendered below the input.
 */
export interface FormFieldProps {
  /** Already-translated label text. */
  label?: string;
  /** Children rendered inside the field (Input, Textarea, Select, custom). */
  children?: ReactNode;
  /** Error message rendered in destructive color below the input. */
  error?: string;
  /** Hint message rendered in muted color below the input. */
  hint?: string;
  /** Renders a required asterisk next to the label. */
  required?: boolean;
  /** htmlFor id to associate the Label with the input. */
  htmlFor?: string;
  /** Extra className applied to the outer container. */
  className?: string;
}

const FIELD_CONTAINER_CLASS =
  "rounded-lg bg-muted/30 border border-border/30 p-3 space-y-1.5";
const LABEL_CLASS =
  "text-xs font-medium text-muted-foreground uppercase tracking-wide";

export function FormField({
  label,
  children,
  error,
  hint,
  required,
  htmlFor,
  className,
}: FormFieldProps) {
  return (
    <div className={cn(FIELD_CONTAINER_CLASS, className)}>
      {label && (
        <Label htmlFor={htmlFor} className={LABEL_CLASS}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
