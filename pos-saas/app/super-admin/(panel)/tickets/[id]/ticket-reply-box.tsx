"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiClientError } from "@/modules/shared";

export function TicketReplyBox({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    try {
      await apiFetch(`/api/super-admin/tickets/${ticketId}/comments`, {
        method: "POST",
        body: { body: trimmed },
      });
      setBody("");
      toast.success("Reply posted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to post reply");
    } finally {
      setPosting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Type your reply to the customer..."
        rows={4}
        disabled={posting}
      />
      <Button type="submit" disabled={posting || !body.trim()}>
        {posting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Post Reply
      </Button>
    </form>
  );
}
