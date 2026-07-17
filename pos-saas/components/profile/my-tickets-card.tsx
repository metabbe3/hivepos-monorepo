"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LifeBuoy, Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/tickets/ticket-status-badge";
import { apiFetch } from "@/modules/shared";

interface TicketRow {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  commentCount: number;
}

export function MyTicketsCard() {
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);

  useEffect(() => {
    apiFetch<TicketRow[]>("/api/tickets")
      .then((r) => setTickets(r.data.slice(0, 3)))
      .catch(() => setTickets([]));
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-rose-500" />
            My Tickets
          </span>
          <Link
            href="/tickets"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {tickets === null ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">
            No tickets yet.{" "}
            <Link href="/tickets/new" className="text-primary hover:underline">
              Submit one
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/tickets/${t.id}`}
                className="block rounded-lg border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{t.subject}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                  {t.commentCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <MessageSquare className="h-3 w-3" />
                      {t.commentCount}
                    </span>
                  )}
                </div>
              </Link>
            ))}
            <Link
              href="/tickets/new"
              className="flex items-center justify-center gap-1 pt-2 text-xs font-medium text-primary hover:underline"
            >
              <ArrowRight className="h-3 w-3" />
              New Ticket
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
