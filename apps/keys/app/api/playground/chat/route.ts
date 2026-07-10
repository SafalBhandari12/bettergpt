import { streamText } from "ai";
import { auth } from "@/lib/chatgpt-auth";
import { resolveTokensByUserId, buildProvider } from "@/lib/gateway-tokens";
import { toCoreMessages, type ChatMessage } from "@/lib/messages";
import { describeGenerationError } from "@/lib/generation-errors";

interface PlaygroundChatBody {
  model?: string;
  messages: ChatMessage[];
}

export async function POST(request: Request) {
  const session = await auth.getSession(request);
  if (session.status !== "authenticated" || !session.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await resolveTokensByUserId(session.user.accountId);
  if (!resolved) {
    return Response.json({ error: "No API key set up yet — create one first.", code: "no_key" }, { status: 400 });
  }
  const chatgpt = buildProvider(resolved);

  const body = (await request.json().catch(() => null)) as PlaygroundChatBody | null;
  if (!body || !Array.isArray(body.messages)) {
    return Response.json({ error: "Expected { messages: [...] }" }, { status: 400 });
  }

  let messages;
  try {
    messages = toCoreMessages(body.messages);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Invalid messages" }, { status: 400 });
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
            send({ error: describeGenerationError(part.error) });
          }
        }
      } catch (err) {
        send({ error: describeGenerationError(err) });
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
