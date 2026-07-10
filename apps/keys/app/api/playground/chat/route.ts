import { auth } from "@/lib/chatgpt-auth";

export async function POST(request: Request) {
  const session = await auth.getSession(request);
  if (session.status !== "authenticated" || !session.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const backendUrl = process.env.BACKEND_URL;
  const internalSecret = process.env.INTERNAL_SECRET;
  if (!backendUrl || !internalSecret) {
    return new Response(JSON.stringify({ error: "Backend not configured" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await request.text();
  const upstream = await fetch(`${backendUrl}/playground/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": internalSecret,
      "x-user-id": session.user.accountId,
    },
    body,
  });

  // Stream the Worker's SSE response straight through.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}
