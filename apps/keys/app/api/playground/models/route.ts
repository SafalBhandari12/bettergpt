import { auth } from "@/lib/chatgpt-auth";
import { resolveTokensByUserId, buildProvider } from "@/lib/gateway-tokens";
import { describeGenerationError } from "@/lib/generation-errors";

export async function GET(request: Request) {
  const session = await auth.getSession(request);
  if (session.status !== "authenticated" || !session.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await resolveTokensByUserId(session.user.accountId);
  if (!resolved) {
    return Response.json({ error: "No API key set up yet — create one first.", code: "no_key" }, { status: 400 });
  }

  try {
    const models = await buildProvider(resolved).listModels();
    return Response.json({ models });
  } catch (err) {
    return Response.json({ error: describeGenerationError(err), code: "provider_error" }, { status: 500 });
  }
}
