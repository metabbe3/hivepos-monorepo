"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** 1-based current page */
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  /** Optional total item count, shown after "page / total". */
  total?: number;
}

/**
 * Minimal prev/next pagination for long client-rendered lists (customers,
 * expenses). Rendering a page slice instead of every row keeps the DOM + React
 * reconciliation small — the main lever for render-bound LCP/INP on these
 * routes. Icon-only controls (no i18n needed); the count is numeric.
 */
export function SimplePagination({ page, totalPages, onPageChange, total }: Props) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted-foreground">
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="tabular-nums">
        {page} / {totalPages}
        {typeof total === "number" ? ` · ${total}` : ""}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
