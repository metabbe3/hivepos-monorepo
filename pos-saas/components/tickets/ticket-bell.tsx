"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/modules/shared";

interface TicketEvent {
  id: string;
  kind: string;
  ticketId: string;
  actorEmail: string;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = {
  "ticket.reply": "New reply",
  "ticket.update_status": "Status updated",
  "ticket.update_priority": "Priority updated",
};

// ponytail: 90s poll. Long-polling/SSE adds infra for marginal latency
// gains on a low-volume channel (support tickets aren't chat).
const POLL_MS = 90_000;

export function TicketBell() {
  const router = useRouter();
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [open, setOpen] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await apiFetch<{ unreadCount: number; events: TicketEvent[] }>(
        "/api/tickets/unread",
      );
      setEvents(res.data.events);
    } catch (err) {
      if (!(err instanceof ApiClientError)) return;
      // 401/403 — quiet fail; the bell is non-critical.
    }
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && events.length > 0) {
      try {
        await apiFetch("/api/tickets/unread", { method: "POST" });
        // Don't clear events immediately — let the user see them in the dropdown.
        // Next poll cycle will reflect the cleared state.
      } catch {}
    }
  }

  const unread = events.length;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-xl p-1">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ticket Updates {unread > 0 && `(${unread} new)`}
        </div>
        {events.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No new updates.
          </div>
        ) : (
          events.map((e) => (
            <DropdownMenuItem
              key={e.id}
              onClick={() => {
                setOpen(false);
                router.push(`/tickets/${e.ticketId}`);
              }}
              className="flex flex-col items-start gap-0.5 rounded-lg px-3 py-2"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {KIND_LABEL[e.kind] ?? "Update"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(e.createdAt).toLocaleDateString()}
                </span>
              </div>
              <span className="text-xs text-muted-foreground truncate w-full">
                by {e.actorEmail}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
