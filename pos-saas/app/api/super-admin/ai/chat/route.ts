import { NextResponse } from "next/server";
import {
  withErrorHandler,
  apiSuccess,
  apiError,
  toAppError,
  ValidationError,
  ForbiddenError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { chatCompletion, chatCompletionStream, type ChatMessage } from "@/lib/ai-client";
import {
  executeSuperAdminToolTruncated,
  SUPER_ADMIN_TOOL_DISPLAY_NAMES,
} from "@/lib/ai-super-admin-tools";
import {
  getSuperAdminAnalyzerPrompt,
  getSuperAdminSynthesizerPrompt,
  getSuperAdminChitchatPrompt,
  isSuperAdminChitchat,
} from "@/lib/ai-super-admin-prompt";

// Super-admin AI assistant endpoint. READ-ONLY platform analytics, streamed via SSE.
// Gate = super-admin session + env kill-switch (SUPERADMIN_AI_ENABLED). No audit log
// (rule #2 is for mutations; this path never writes).

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

interface ToolCall {
  name: string;
  args?: Record<string, unknown>;
}
interface AnalyzerPlan {
  clear: boolean;
  followUp?: string | null;
  options?: string[];
  subtasks?: { id: string; description?: string; tools?: ToolCall[] }[];
}

function isChatMsg(m: unknown): m is ChatMessage {
  return (
    typeof m === "object" &&
    m !== null &&
    typeof (m as { role?: unknown }).role === "string" &&
    typeof (m as { content?: unknown }).content === "string"
  );
}

/** Pull the first JSON object out of a model reply (handles ```json fences + stray prose). */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

/** Read an Ollama NDJSON stream, calling onDelta for each content token. */
async function pumpOllamaStream(res: Response, onDelta: (content: string) => void): Promise<void> {
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM API error (${res.status}): ${text}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let malformedStreak = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const data = JSON.parse(trimmed);
        if (data.done) return;
        const content = data.message?.content;
        if (typeof content === "string" && content) {
          onDelta(content);
          malformedStreak = 0;
        }
      } catch {
        // ponytail: fail fast on a garbage stream (API mismatch) instead of waiting
        // out the fetch timeout — bounded by chatCompletionStream's AbortSignal either way.
        if (++malformedStreak > 100) throw new Error("LLM stream returned invalid data");
      }
    }
  }
}

export const GET = withErrorHandler(async () => {
  await assertSuperAdminOrThrow();
  return apiSuccess({
    enabled: process.env.SUPERADMIN_AI_ENABLED === "true",
    model: process.env.LLM_MODEL || "qwen3:8b",
  });
});

// Streaming SSE — can't go through withErrorHandler (it returns a JSON envelope),
// so we map errors manually with the same apiError/toAppError helpers.
export async function POST(req: Request) {
  try {
    await assertSuperAdminOrThrow();
    // ponytail: env kill-switch — local AI is a single fragile box; keep it off until
    // the operator points the app at their Ollama/LM-Studio endpoint.
    if (process.env.SUPERADMIN_AI_ENABLED !== "true") {
      throw new ForbiddenError("AI assistant is disabled");
    }

    const body = await req.json().catch(() => ({}));
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    const history: ChatMessage[] = Array.isArray(body?.history) ? body.history.filter(isChatMsg) : [];
    if (!question) throw new ValidationError("question is required");

    const stream = runPipeline(question, history);
    return new NextResponse(stream, { headers: SSE_HEADERS });
  } catch (error) {
    return apiError(toAppError(error));
  }
}

function runPipeline(question: string, history: ChatMessage[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const sendDone = () => controller.enqueue(encoder.encode("data: [DONE]\n\n"));

      try {
        // Chitchat shortcut — one stream call, skip the full pipeline.
        if (isSuperAdminChitchat(question) && history.length === 0) {
          await pumpOllamaStream(
            await chatCompletionStream({
              messages: [
                { role: "system", content: getSuperAdminChitchatPrompt() },
                { role: "user", content: question },
              ],
              temperature: 0.6,
            }),
            (content) => send({ type: "delta", content }),
          );
          sendDone();
          return;
        }

        // 1. Analyze → strict-JSON tool plan.
        const analysisRaw = await chatCompletion({
          messages: [
            { role: "system", content: getSuperAdminAnalyzerPrompt() },
            ...history.slice(-6),
            { role: "user", content: question },
          ],
          format: "json",
          temperature: 0.2,
        });

        let plan: AnalyzerPlan;
        try {
          plan = JSON.parse(extractJson(analysisRaw)) as AnalyzerPlan;
        } catch {
          send({ type: "delta", content: "Maaf, saya belum bisa memahami pertanyaan itu. Coba pertanyakan dengan lebih spesifik?" });
          sendDone();
          return;
        }

        if (!plan.clear) {
          const opts = (plan.options ?? []).map((o) => `• ${o}`).join("\n");
          send({ type: "delta", content: `${plan.followUp ?? "Bisa diperjelas?"}${opts ? "\n\n" + opts : ""}` });
          sendDone();
          return;
        }

        // 2. Collect + execute tools (parallel), streaming progress chips.
        const calls: ToolCall[] =
          (plan.subtasks ?? []).flatMap((s) => s.tools ?? []) ?? [];
        const effective = calls.length > 0 ? calls : [{ name: "get_platform_overview", args: {} }];

        const results = await Promise.all(
          effective.map(async (c) => {
            const label = SUPER_ADMIN_TOOL_DISPLAY_NAMES[c.name] ?? c.name;
            send({ type: "tool", name: c.name, label, status: "running" });
            const result = await executeSuperAdminToolTruncated(c.name, c.args ?? {});
            send({ type: "tool", name: c.name, label, status: "done" });
            return { label, result };
          }),
        );

        const allData = results
          .map((r) => `\n### [${r.label}]\n${r.result}`)
          .join("\n");

        // 3. Synthesize → stream the final answer.
        await pumpOllamaStream(
          await chatCompletionStream({
            messages: [
              { role: "system", content: getSuperAdminSynthesizerPrompt(question, allData) },
              { role: "user", content: question },
            ],
            temperature: 0.4,
          }),
          (content) => send({ type: "delta", content }),
        );
        sendDone();
      } catch {
        // In-stream failure (Ollama box down / timeout) — never hang the UI.
        send({ type: "delta", content: "Maaf, asisten sedang tidak tersedia. Coba lagi dalam beberapa saat." });
        sendDone();
      } finally {
        controller.close();
      }
    },
  });
}
