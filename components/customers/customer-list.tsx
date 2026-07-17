"use client";

import { useState } from "react";
import Link from "next/link";
import { CustomerCard } from "./customer-card";
import { SimplePagination } from "@/components/shared/simple-pagination";
import type { CustomerListItem } from "./types";

// Render a page slice, not every customer. The full list (hundreds of cards)
// produced a ~19k-node DOM and gated LCP/INP — paginating caps render cost.
const PAGE_SIZE = 24;

interface CustomerListProps {
  customers: CustomerListItem[];
  /** When true, cards are NOT wrapped in a Link (employees can't open detail). */
  isEmployee?: boolean;
  onEdit: (customer: CustomerListItem) => void;
  onDelete: (customer: CustomerListItem) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function CustomerList({
  customers,
  isEmployee = false,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: CustomerListProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  // Clamp to a valid page when the list shrinks (search/filter) — avoids an
  // empty slice without needing a layout effect.
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = customers.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map((c) =>
          isEmployee ? (
            <CustomerCard
              key={c.id}
              customer={c}
              onEdit={onEdit}
              onDelete={onDelete}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ) : (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 rounded-xl"
            >
              <CustomerCard
                customer={c}
                onEdit={onEdit}
                onDelete={onDelete}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            </Link>
          ),
        )}
      </div>
      <SimplePagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        total={customers.length}
      />
    </div>
  );
}
