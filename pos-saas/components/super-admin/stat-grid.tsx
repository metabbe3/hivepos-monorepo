import { cn } from "@/lib/utils";

export function StatGrid({
  children,
  cols = 4,
  className,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 6;
  className?: string;
}) {
  const colClass = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  }[cols];
  return (
    <div className={cn("grid gap-3 md:gap-4", colClass, className)}>{children}</div>
  );
}

export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  // ponytail: plain uppercase muted label — matches tenant section headers.
  return (
    <h2 className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 first:mt-0">
      {children}
    </h2>
  );
}
