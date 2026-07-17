import { cn } from "@/lib/utils";

/**
 * ponytail: fixed soft gradient layer behind every super-admin page.
 * Sits inside the panel main, behind content. Pointer-events: none.
 */
export function MeshBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 sa-mesh opacity-70 dark:opacity-40",
        className,
      )}
    />
  );
}
