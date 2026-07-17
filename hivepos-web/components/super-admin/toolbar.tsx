import { cn } from "@/lib/utils";

export function Toolbar({
  left,
  right,
  className,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      {left && <div className="flex flex-wrap items-center gap-2">{left}</div>}
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function SearchInput({
  value,
  placeholder = "Search…",
  className,
}: {
  value?: string;
  placeholder?: string;
  className?: string;
}) {
  // ponytail: shadcn Input style — soft border, ring on focus.
  return (
    <div className={cn("relative", className)}>
      <input
        type="search"
        name="q"
        defaultValue={value}
        placeholder={placeholder}
        className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent pl-9 pr-2.5 py-1 text-base text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus:outline-none"
      />
      <svg
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    </div>
  );
}
