"use client";

import { useRef } from "react";
import { RotateCcw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TemplateManifestEntry } from "@/lib/whatsapp-templates";

interface Props {
  template: TemplateManifestEntry;
  value: string;
  onChange: (next: string) => void;
  onReset: () => void;
}

/**
 * ponytail: one row per template. Variable chips click-insert at the textarea
 * cursor via selectionStart. "Dimodifikasi" badge + reset button only show
 * when value diverges from default (any difference, including whitespace).
 */
export function TemplateEditor({ template, value, onChange, onReset }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const isDirty = value !== template.defaultBody;

  function insertVar(name: string) {
    const ta = taRef.current;
    if (!ta) {
      onChange(value + `{{${name}}}`);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + `{{${name}}}` + value.slice(end);
    onChange(next);
    // Restore cursor after React re-render.
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + name.length + 4;
      ta.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">{template.label}</h3>
            {isDirty && (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px]">
                Dimodifikasi
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
        </div>
        {isDirty && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="shrink-0 h-7 px-2 text-xs"
            title="Reset ke default"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset
          </Button>
        )}
      </div>

      <Textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(10, Math.max(4, value.split("\n").length + 1))}
        maxLength={template.maxLength}
        className="font-mono text-xs"
      />

      {template.variables.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Klik untuk sisipkan:
          </span>
          {template.variables.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => insertVar(v.name)}
              title={`${v.description}${v.required ? " (wajib)" : ""}`}
              className="inline-flex items-center gap-0.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-primary/10 hover:border-primary/50 transition-colors"
            >
              {v.description.split("(")[0].trim()}
              {v.required && <span className="text-destructive">*</span>}
            </button>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-right">
        {value.length}/{template.maxLength}
      </p>
    </div>
  );
}
