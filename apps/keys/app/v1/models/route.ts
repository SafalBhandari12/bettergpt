import { resolveTokensByKey, buildProvider } from "@/lib/gateway-tokens";
import { describeGenerationError } from "@/lib/generation-errors";

function openAIError(message: string, type = "invalid_request_error") {
  return { error: { message, type } };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const key = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!key) return Response.json(openAIError("Missing API key"), { status: 401 });

  const resolved = await resolveTokensByKey(key);
  if (!resolved) return Response.json(openAIError("Invalid API key"), { status: 401 });

  try {
    const models = await buildProvider(resolved).listModels();
    return Response.json({
      object: "list",
      data: models.map((id) => ({ id, object: "model", created: 0, owned_by: "chatgpt" })),
    });
  } catch (err) {
    return Response.json(openAIError(describeGenerationError(err), "server_error"), { status: 500 });
  }
}
