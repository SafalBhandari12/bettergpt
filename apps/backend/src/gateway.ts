import { Hono, type Context } from "hono";
import { createChatGPT, type ChatGPTProvider } from "@opencoredev/loginwithchatgpt-ai";
import { streamText, generateText } from "ai";
import type { Env, Variables } from "./env";
import { decryptJson, encryptJson, sha256Hex } from "./crypto";

type GatewayContext = Context<{ Bindings: Env; Variables: Variables }>;

interface ChatMessage {
  role: string;
  content: unknown;
}

interface ChatCompletionsRequestBody {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
}

function openAIError(message: string, type = "invalid_request_error") {
  return { error: { message, type } };
}

/** Extracts the Bearer key, resolves it to a user, and builds a ChatGPT
 * provider wired to that user's (auto-refreshed) OAuth tokens. Returns a
 * Response directly on any auth failure, so callers can `return` it as-is. */
async function resolveGatewayAuth(
  c: GatewayContext,
): Promise<{ userId: string; chatgpt: ChatGPTProvider } | Response> {
  const authHeader = c.req.header("authorization") ?? "";
  const key = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!key) return c.json(openAIError("Missing API key"), 401);

  const keyHash = await sha256Hex(key);
  const keyRow = await c.env.DB.prepare(
    "SELECT user_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL",
  )
    .bind(keyHash)
    .first<{ user_id: string }>();
  if (!keyRow) return c.json(openAIError("Invalid API key"), 401);
  const userId = keyRow.user_id;

  const tokenRow = await c.env.DB.prepare(
    "SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE user_id = ?",
  )
    .bind(userId)
    .first<{ access_token: string; refresh_token: string | null; expires_at: number | null }>();
  if (!tokenRow) {
    return c.json(openAIError("No ChatGPT session linked to this key", "server_error"), 500);
  }

  const accessToken = await decryptJson<string>(tokenRow.access_token, c.env.TOKEN_ENCRYPTION_KEY);
  const refreshToken = tokenRow.refresh_token
    ? await decryptJson<string>(tokenRow.refresh_token, c.env.TOKEN_ENCRYPTION_KEY)
    : undefined;

  const chatgpt = createChatGPT({
    credentials: { accessToken, refreshToken, accountId: userId, expiresAt: tokenRow.expires_at ?? undefined },
    onRefresh: async (fresh) => {
      const now = Date.now();
      const encAccess = await encryptJson(fresh.accessToken, c.env.TOKEN_ENCRYPTION_KEY);
      const encRefresh = fresh.refreshToken
        ? await encryptJson(fresh.refreshToken, c.env.TOKEN_ENCRYPTION_KEY)
        : null;
      await c.env.DB.prepare(
        "UPDATE oauth_tokens SET access_token = ?, refresh_token = COALESCE(?, refresh_token), expires_at = ?, updated_at = ? WHERE user_id = ?",
      )
        .bind(encAccess, encRefresh, fresh.expiresAt ?? null, now, userId)
        .run();
    },
  });

  await c.env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?")
    .bind(Date.now(), keyHash)
    .run();

  return { userId, chatgpt };
}

function toCoreMessages(
  raw: ChatMessage[],
): { role: "system" | "user" | "assistant"; content: string }[] {
  return raw.map((m) => {
    if (m.role !== "system" && m.role !== "user" && m.role !== "assistant") {
      throw new Error(`Unsupported role: ${m.role}`);
    }
    if (typeof m.content !== "string") {
      throw new Error("Only string message content is supported");
    }
    return { role: m.role, content: m.content };
  });
}

export const gateway = new Hono<{ Bindings: Env; Variables: Variables }>();

gateway.post("/chat/completions", async (c) => {
  const auth = await resolveGatewayAuth(c);
  if (auth instanceof Response) return auth;
  const { chatgpt } = auth;

  const body = await c.req.json<ChatCompletionsRequestBody>().catch(() => null);
  if (!body || !Array.isArray(body.messages)) {
    return c.json(openAIError("Expected { messages: [...] }"), 400);
  }

  let messages: { role: "system" | "user" | "assistant"; content: string }[];
  try {
    messages = toCoreMessages(body.messages);
  } catch (err) {
    return c.json(openAIError(err instanceof Error ? err.message : "Invalid messages"), 400);
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
        // `streamText` reports provider/network failures as an "error" part on
        // `fullStream` rather than throwing out of `textStream` — iterating
        // `textStream` directly would silently end the response with an
        // empty "stop" instead of surfacing the failure.
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
              send(
                openAIError(
                  part.error instanceof Error ? part.error.message : "Generation failed",
                  "server_error",
                ),
              );
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
          send(openAIError(err instanceof Error ? err.message : "Stream failed", "server_error"));
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
    const result = await generateText({ model: chatgpt(model), messages });
    const promptTokens = result.usage?.inputTokens ?? 0;
    const completionTokens = result.usage?.outputTokens ?? 0;
    return c.json({
      id,
      object: "chat.completion",
      created,
      model,
      choices: [{ index: 0, message: { role: "assistant", content: result.text }, finish_reason: "stop" }],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    });
  } catch (err) {
    return c.json(openAIError(err instanceof Error ? err.message : "Generation failed", "server_error"), 500);
  }
});

gateway.get("/models", async (c) => {
  const auth = await resolveGatewayAuth(c);
  if (auth instanceof Response) return auth;

  try {
    const models = await auth.chatgpt.listModels();
    return c.json({
      object: "list",
      data: models.map((id) => ({ id, object: "model", created: 0, owned_by: "chatgpt" })),
    });
  } catch (err) {
    return c.json(openAIError(err instanceof Error ? err.message : "Failed to list models", "server_error"), 500);
  }
});
