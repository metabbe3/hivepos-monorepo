const LLM_API_URL = process.env.LLM_API_URL || "http://192.168.2.1:11434";
const LLM_MODEL = process.env.LLM_MODEL || "qwen3:8b";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

interface ChatOptions {
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  // ponytail: forcing `format:"json"` (Ollama) makes the analyzer's JSON plan
  // reliable on a local model; timeout caps flaky-LAN-box hangs. Both optional +
  // backward-compatible — tenant path ignores them.
  format?: "json";
  timeoutMs?: number;
}

/**
 * Call Ollama /api/chat endpoint (non-streaming).
 * Returns the assistant message content string.
 */
export async function chatCompletion(options: ChatOptions): Promise<string> {
  const { messages, temperature = 0.7, format, timeoutMs = 60000 } = options;

  const response = await fetch(`${LLM_API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      stream: false,
      ...(format ? { format } : {}),
      options: { temperature },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`LLM API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.message?.content ?? "";
}

/**
 * Call Ollama /api/chat endpoint with streaming.
 * Returns the raw Response for streaming to the client.
 */
export async function chatCompletionStream(options: ChatOptions) {
  const { messages, temperature = 0.7, format, timeoutMs = 120000 } = options;

  const response = await fetch(`${LLM_API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      stream: true,
      ...(format ? { format } : {}),
      options: { temperature },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`LLM API error (${response.status}): ${text}`);
  }

  return response;
}

/**
 * Convert Ollama NDJSON stream to SSE format for the frontend.
 * Ollama sends: {"message":{"content":"token","thinking":"..."},"done":false} per line
 * Frontend expects: data: {"choices":[{"delta":{"content":"token","thinking":"..."}}]}
 */
export function ollamaStreamToSSE(ollamaResponse: Response): ReadableStream {
  const reader = ollamaResponse.body?.getReader();
  if (!reader) throw new Error("No response body");

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            if (data.done) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
            const msg = data.message;
            if (msg) {
              const delta: { content?: string; thinking?: string } = {};
              if (msg.thinking) delta.thinking = msg.thinking;
              if (msg.content) delta.content = msg.content;
              if (delta.content || delta.thinking) {
                const sse = `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
                controller.enqueue(encoder.encode(sse));
              }
            }
          } catch {
            // skip malformed lines
          }
        }
      } catch {
        controller.close();
      }
    },
  });
}
