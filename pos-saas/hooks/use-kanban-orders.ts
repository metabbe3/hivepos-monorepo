"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/modules/shared";

// ponytail: module-level cache + subscriber set so KanbanBoard and SLATracker
// share one fetch + one 30s interval instead of two. Promises dedupe so
// concurrent mounts issue a single request. SWR would also work; this is the
// smallest thing that fixes the duplicate poll without adding a dependency.

export interface KanbanOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  paidAmount: number;
  isExpress: boolean;
  items: { serviceName: string; quantity: number; weightKg: number | null }[];
  createdAt: string;
  receivedAt: string | null;
  inProgressAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
}

type Cache = { orders: KanbanOrder[] | null; ts: number };
let cache: Cache = { orders: null, ts: 0 };
let inflight: Promise<KanbanOrder[]> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
const subscribers = new Set<(orders: KanbanOrder[] | null) => void>();

async function fetchOnce(): Promise<KanbanOrder[]> {
  if (inflight) return inflight;
  inflight = apiFetch<KanbanOrder[]>("/api/dashboard/kanban")
    .then(({ data }) => {
      cache = { orders: data, ts: Date.now() };
      subscribers.forEach((fn) => fn(data));
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useKanbanOrders() {
  const [orders, setOrders] = useState<KanbanOrder[] | null>(cache.orders);

  useEffect(() => {
    const fn = (o: KanbanOrder[] | null) => setOrders(o);
    subscribers.add(fn);

    // First mount (or after idle) triggers immediate fetch + starts interval.
    if (!intervalId) {
      if (cache.ts === 0) void fetchOnce();
      intervalId = setInterval(() => void fetchOnce(), 30_000);
    } else if (cache.orders) {
      // Already had data — make sure this subscriber renders immediately.
      fn(cache.orders);
    }

    return () => {
      subscribers.delete(fn);
      if (subscribers.size === 0 && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, []);

  return {
    orders,
    loading: cache.orders === null,
    refetch: () => fetchOnce(),
  };
}
