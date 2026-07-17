import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border/30">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="rounded-xl border border-border/40 bg-card">
        <div className="px-4 py-3 border-b border-border/30">
          <Skeleton className="h-5 w-32" />
        </div>
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card animate-in fade-in duration-300">
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="rounded-xl border border-border/40 bg-card p-6 space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
