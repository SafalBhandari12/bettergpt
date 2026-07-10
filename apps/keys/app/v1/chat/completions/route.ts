import { streamText } from "ai";
import { resolveTokensByKey, buildProvider } from "@/lib/gateway-tokens";
import { toCoreMessages, type ChatMessage, type CoreMessage } from "@/lib/messages";
import { describeGenerationError } from "@/lib/generation-errors";

interface ChatCompletionsRequestBody {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
}

function openAIError(message: string, type = "invalid_request_error") {
  return { error: { message, type } };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const key = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!key) return Response.json(openAIError("Missing API key"), { status: 401 });

  const resolved = await resolveTokensByKey(key);
  if (!resolved) return Response.json(openAIError("Invalid API key"), { status: 401 });
  const chatgpt = buildProvider(resolved);

  const body = (await request.json().catch(() => null)) as ChatCompletionsRequestBody | null;
  if (!body || !Array.isArray(body.messages)) {
    return Response.json(openAIError("Expected { messages: [...] }"), { status: 400 });
  }

  let messages: CoreMessage[];
  try {
    messages = toCoreMessages(body.messages);
  } catch (err) {
    return Response.json(openAIError(err instanceof Error ? err.message : "Invalid messages"), { status: 400 });
  }

  const model = body.model || "gpt-5.5";
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);

  if (body.stream) {
    const result = streamText({ model: chatgpt(model), messages });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        send({
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
        });
        // `streamText` reports provider/network failures as an "error" part
        // on `fullStream` rather than throwing out of `textStream` —
        // iterating `textStream` directly would silently end the response
        // with an empty "stop" instead of surfacing the failure.
        let sawError = false;
        try {
          for await (const part of result.fullStream) {
            if (part.type === "text-delta") {
              send({
                id,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{ index: 0, delta: { content: part.text }, finish_reason: null }],
              });
            } else if (part.type === "error") {
              sawError = true;
              send(openAIError(describeGenerationError(part.error), "server_error"));
            }
          }
          if (!sawError) {
            send({
              id,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            });
          }
        } catch (err) {
          send(openAIError(describeGenerationError(err), "server_error"));
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  }

  try {
    // Codex's backend rejects non-streaming requests outright ("Stream must
    // be set to true") — it only ever serves the ChatGPT app, which always
    // streams. So even for a "non-streaming" API call we still request a
    // stream from Codex; `streamText`'s `.text`/`.usage` just consume it
    // fully before resolving, giving the same one-shot response shape.
    const result = streamText({ model: chatgpt(model), messages });
    const text = await result.text;
    const usage = await result.usage;
    const promptTokens = usage?.inputTokens ?? 0;
    const completionTokens = usage?.outputTokens ?? 0;
    return Response.json({
      id,
      object: "chat.completion",
      created,
      model,
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    });
  } catch (err) {
    return Response.json(openAIError(describeGenerationError(err), "server_error"), { status: 500 });
  }
}
