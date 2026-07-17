"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Send, Star, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageLoading } from "@/components/shared/loading";
import { StatusBadge, PriorityBadge } from "@/components/tickets/ticket-status-badge";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useTranslation } from "@/hooks/use-translation";

interface TicketComment {
  id: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  csatRating: number | null;
  csatComment: string | null;
  submitterName: string;
  submitterEmail: string;
  comments: TicketComment[];
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useTranslation();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);
  const [csatRating, setCsatRating] = useState(0);
  const [csatHover, setCsatHover] = useState(0);
  const [csatComment, setCsatComment] = useState("");
  const [postingCsat, setPostingCsat] = useState(false);

  const locale = lang === "id" ? "id-ID" : "en-US";

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<TicketDetail>(`/api/tickets/${params.id}`);
      setTicket(res.data);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("tickets.notFound"));
      router.push("/tickets");
    } finally {
      setLoading(false);
    }
  }, [params.id, router, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function postReply(e: React.FormEvent) {
    e.preventDefault();
    const body = reply.trim();
    if (!body) return;
    setPosting(true);
    try {
      await apiFetch(`/api/tickets/${params.id}/comments`, {
        method: "POST",
        body: { body },
      });
      setReply("");
      toast.success(t("tickets.replied"));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("tickets.replyPlaceholder"));
    } finally {
      setPosting(false);
    }
  }

  async function submitCsat(e: React.FormEvent) {
    e.preventDefault();
    if (csatRating < 1) return;
    setPostingCsat(true);
    try {
      await apiFetch(`/api/tickets/${params.id}/csat`, {
        method: "POST",
        body: { rating: csatRating, comment: csatComment },
      });
      toast.success(t("tickets.csatRated"));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("tickets.csatSubmit"));
    } finally {
      setPostingCsat(false);
    }
  }

  if (loading || !ticket) return <PageLoading />;

  const showCsat =
    ["RESOLVED", "CLOSED"].includes(ticket.status) && ticket.csatRating === null;

  // ponytail: t() has no interpolation; substitute placeholders manually for the few keys that need it.
  const byLine = t("tickets.by")
    .replace("{name}", ticket.submitterName)
    .replace("{date}", new Date(ticket.createdAt).toLocaleString(locale));
  const repliesHeading = t("tickets.repliesCount").replace("{n}", String(ticket.comments.length));
  const ratedLine = t("tickets.rated").replace("{n}", String(ticket.csatRating));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/tickets" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("tickets.back")}
        </Link>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="text-xl font-bold">{ticket.subject}</h1>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <p className="text-sm text-muted-foreground">{byLine}</p>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm">{ticket.description}</p>

        {ticket.csatRating !== null && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm dark:border-amber-900 dark:bg-amber-950">
            <span className="text-amber-500">{"★".repeat(ticket.csatRating)}</span>
            <span className="ml-2 text-muted-foreground">{ratedLine}</span>
            {ticket.csatComment && <p className="mt-1 italic">"{ticket.csatComment}"</p>}
          </div>
        )}
      </div>

      {/* CSAT prompt */}
      {showCsat && (
        <form onSubmit={submitCsat} className="rounded-2xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-lg font-bold">{t("tickets.csatTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("tickets.csatPrompt")}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setCsatHover(n)}
                onMouseLeave={() => setCsatHover(0)}
                onClick={() => setCsatRating(n)}
                className="p-1"
                aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
              >
                <Star
                  className={`h-7 w-7 transition-colors ${
                    (csatHover || csatRating) >= n
                      ? "fill-amber-400 text-amber-400"
                      : "fill-transparent text-muted-foreground/40"
                  }`}
                />
              </button>
            ))}
          </div>
          <Textarea
            value={csatComment}
            onChange={(e) => setCsatComment(e.target.value)}
            placeholder={t("tickets.csatCommentPlaceholder")}
            rows={2}
          />
          <Button type="submit" disabled={csatRating < 1 || postingCsat}>
            {postingCsat && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("tickets.csatSubmit")}
          </Button>
        </form>
      )}

      {/* Comments */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <MessageSquare className="h-4 w-4" />
          {repliesHeading}
        </h2>

        {ticket.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t("tickets.noReplies")}
          </p>
        ) : (
          <div className="space-y-3">
            {ticket.comments.map((c) => {
              const isTenant = c.authorRole === "TENANT_USER";
              const when = new Date(c.createdAt).toLocaleString(locale);
              const who = isTenant
                ? t("tickets.youOn").replace("{date}", when)
                : t("tickets.staffOn").replace("{date}", when);
              return (
                <div
                  key={c.id}
                  className={`rounded-lg border p-3 text-sm ${
                    isTenant
                      ? "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30"
                      : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {isTenant ? t("tickets.reply") : c.authorName}
                    </span>
                    <span className="text-xs text-muted-foreground">{who}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Reply box */}
        <form onSubmit={postReply} className="mt-4 flex gap-2">
          <Input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={t("tickets.replyPlaceholder")}
            disabled={posting}
          />
          <Button type="submit" size="icon" disabled={posting || !reply.trim()}>
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
