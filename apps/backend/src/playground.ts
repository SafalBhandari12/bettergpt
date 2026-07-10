import { Hono } from "hono";
import { streamText } from "ai";
import type { Env, Variables } from "./env";
import { requireUserId } from "./middleware";
import { getChatGPTProviderForUser } from "./oauth-provider";
import { toCoreMessages, type ChatMessage } from "./messages";

interface PlaygroundChatBody {
  model?: string;
  messages: ChatMessage[];
}

export const playground = new Hono<{ Bindings: Env; Variables: Variables }>();

playground.use("*", requireUserId);

// Lets a signed-in user try the API directly from the dashboard, without
// needing to have a plaintext key handy (we only ever show that once). Auth
// is the same trusted x-user-id from the BFF session — no API key involved.
playground.post("/chat", async (c) => {
  const userId = c.get("userId");
  const chatgpt = await getChatGPTProviderForUser(c.env.DB, c.env.TOKEN_ENCRYPTION_KEY, userId);
  if (!chatgpt) {
    return c.json({ error: "No API key set up yet — create one first." }, 400);
  }

  const body = await c.req.json<PlaygroundChatBody>().catch(() => null);
  if (!body || !Array.isArray(body.messages)) {
    return c.json({ error: "Expected { messages: [...] }" }, 400);
  }

  let messages;
  try {
    messages = toCoreMessages(body.messages);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Invalid messages" }, 400);
  }

  const model = body.model || "gpt-5.5";
  const result = streamText({ model: chatgpt(model), messages });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            send({ delta: part.text });
          } else if (part.type === "error") {
            send({ error: part.error instanceof Error ? part.error.message : "Generation failed" });
          }
        }
      } catch (err) {
        send({ error: err instanceof Error ? err.message : "Stream failed" });
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
});

playground.get("/models", async (c) => {
  const userId = c.get("userId");
  const chatgpt = await getChatGPTProviderForUser(c.env.DB, c.env.TOKEN_ENCRYPTION_KEY, userId);
  if (!chatgpt) {
    return c.json({ error: "No API key set up yet — create one first." }, 400);
  }

  try {
    const models = await chatgpt.listModels();
    return c.json({ models });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to list models" }, 500);
  }
});
