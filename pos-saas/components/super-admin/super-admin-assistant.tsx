"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { Sparkles, X, Send, Bot, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Floating AI assistant for the super-admin panel. English chrome (panel is
// English-only by design); the model answers in Bahasa Indonesia for the operator.
// Streams from /api/super-admin/ai/chat (SSE: {type:"tool"} chips + {type:"delta"} tokens).

interface ToolChip {
  name: string;
  label: string;
  status: "running" | "done";
}
interface Message {
  role: "user" | "assistant";
  content: string;
  tools?: ToolChip[];
}

const SUGGEST_RE = /<<SUGGEST>>([\s\S]*?)<<\/SUGGEST>>/g;

function extractSuggestions(content: string): string[] {
  const out: string[] = [];
  for (const m of content.matchAll(SUGGEST_RE)) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  return out;
}
function stripSuggestions(content: string): string {
  return content.replace(SUGGEST_RE, "").trim();
}

/** Minimal markdown → JSX: **bold**, "- " bullet lists, line breaks. No deps. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
function renderMarkdown(text: string): ReactNode {
  const lines = stripSuggestions(text).split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: number) => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${key}`} className="ml-4 list-disc space-y-0.5">
          {list.map((li, i) => (
            <li key={i}>{inline(li.replace(/^\s*[-•]\s*/, ""))}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  lines.forEach((line, i) => {
    if (/^\s*[-•]\s+/.test(line)) {
      list.push(line);
    } else {
      flush(i);
      if (line.trim()) {
        blocks.push(
          <p key={i} className="whitespace-pre-wrap leading-relaxed">
            {inline(line)}
          </p>,
        );
      }
    }
  });
  flush(lines.length);
  return blocks;
}

export function SuperAdminAssistant() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [model, setModel] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkEnabled = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/ai/chat", { method: "GET" });
      const json = await res.json();
      setEnabled(json?.data?.enabled === true);
      setModel(json?.data?.model ?? "");
    } catch {
      setEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (open && enabled === null) void checkEnabled();
  }, [open, enabled, checkEnabled]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || sending || enabled !== true) return;

    const history = messages.map((m) => ({ role: m.role, content: stripSuggestions(m.content) })).slice(-6);
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: question }, { role: "assistant", content: "", tools: [] }]);

    const patch = (fn: (last: Message) => Message) =>
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const copy = prev.slice();
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });

    try {
      const res = await fetch("/api/super-admin/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!res.ok || !res.body) {
        patch((l) => ({ ...l, content: "Gagal menghubungi asisten. Periksa koneksi server." }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const evt = JSON.parse(payload);
              if (evt.type === "tool") {
                patch((l) => {
                  const tools = [...(l.tools ?? [])];
                  const i = tools.findIndex((t) => t.name === evt.name);
                  const chip: ToolChip = { name: evt.name, label: evt.label, status: evt.status };
                  if (i >= 0) tools[i] = chip;
                  else tools.push(chip);
                  return { ...l, tools };
                });
              } else if (evt.type === "delta" && typeof evt.content === "string") {
                patch((l) => ({ ...l, content: l.content + evt.content }));
              }
            } catch {
              // skip malformed event
            }
          }
        }
      }
    } catch {
      patch((l) => ({ ...l, content: l.content || "Asisten tidak tersedia sekarang." }));
    } finally {
      setSending(false);
    }
  }, [input, sending, enabled, messages]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105"
        title="Ask AI"
        aria-label="Open AI assistant"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[600px] max-h-[85vh] w-[400px] max-w-[calc(100vw-2.5rem)] flex-col rounded-xl border bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Platform Assistant</div>
            <div className="text-[11px] text-muted-foreground">
              {enabled === null ? "…" : enabled ? model || "ready" : "disabled"}
            </div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {enabled === false ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Assistant is disabled</p>
            <p className="text-xs text-muted-foreground">
              Set <code className="rounded bg-muted px-1">SUPERADMIN_AI_ENABLED=true</code> and configure{" "}
              <code className="rounded bg-muted px-1">LLM_API_URL</code> /{" "}
              <code className="rounded bg-muted px-1">LLM_MODEL</code> in your environment, then restart.
            </p>
            <Button variant="outline" size="sm" onClick={checkEnabled}>
              <RefreshCw className="mr-1 h-3 w-3" /> Recheck
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tanya apa saja tentang kesehatan platform — MRR, tenant, tiket, error.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Ringkasan platform", "MRR sekarang berapa?", "Tenant yang at-risk?", "Tiket urgent belum selesai?"].map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted"
                  >
                    {s}
                  </button>
                ),
              )}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] space-y-2", m.role === "user" ? "rounded-2xl bg-primary px-3 py-2 text-primary-foreground" : "")}>
                {m.tools && m.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.tools.map((t, j) => (
                      <span
                        key={j}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
                          t.status === "running" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {t.status === "running" && <RefreshCw className="h-2.5 w-2.5 animate-spin" />}
                        {t.label}
                      </span>
                    ))}
                  </div>
                )}
                {m.role === "assistant" ? (
                  <div className="text-sm">{m.content ? renderMarkdown(m.content) : <span className="text-muted-foreground">…</span>}</div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                )}
                {m.role === "assistant" && m.content && extractSuggestions(m.content).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {extractSuggestions(m.content).slice(0, 3).map((s, j) => (
                      <button
                        key={j}
                        onClick={() => setInput(s)}
                        className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={enabled ? "Tanya tentang platform…" : "Assistant disabled"}
            disabled={enabled !== true || sending}
            className="max-h-28 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <Button size="icon" onClick={() => void send()} disabled={!input.trim() || sending || enabled !== true} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
