"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Back button for detail pages. Uses `router.back()` so it returns to the
 * *originating* list — and because list filters are URL-backed (useUrlState),
 * they're still intact on return.
 */
export function BackButton({
  label = "Kembali",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
