/**
 * Server-only client for the Cloudflare Worker backend (apps/backend).
 * Only imported from Next.js route handlers, which have already resolved
 * the caller's ChatGPT session into an `accountId` — the Worker trusts
 * whatever `x-user-id` this sends, so it must never be reachable from the
 * browser directly.
 */

export interface RemoteConversationMeta {
  id: string;
  title: string;
  updatedAt: number;
}

export interface RemoteConversation extends RemoteConversationMeta {
  data: unknown;
}

function backendUrl(path: string): string {
  const base = process.env.BACKEND_URL;
  if (!base) throw new Error("BACKEND_URL is not configured");
  return `${base}${path}`;
}

function backendHeaders(userId: string): HeadersInit {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) throw new Error("INTERNAL_SECRET is not configured");
  return {
    "x-internal-secret": secret,
    "x-user-id": userId,
    "content-type": "application/json",
  };
}

export async function listConversations(userId: string): Promise<RemoteConversationMeta[]> {
  const res = await fetch(backendUrl("/conversations"), {
    headers: backendHeaders(userId),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Backend list failed: ${res.status}`);
  return res.json();
}

export async function getConversation(
  userId: string,
  id: string,
): Promise<RemoteConversation | null> {
  const res = await fetch(backendUrl(`/conversations/${id}`), {
    headers: backendHeaders(userId),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Backend get failed: ${res.status}`);
  return res.json();
}

export async function saveConversation(
  userId: string,
  id: string,
  title: string,
  data: unknown,
): Promise<RemoteConversationMeta> {
  const res = await fetch(backendUrl(`/conversations/${id}`), {
    method: "PUT",
    headers: backendHeaders(userId),
    body: JSON.stringify({ title, data }),
  });
  if (!res.ok) throw new Error(`Backend save failed: ${res.status}`);
  return res.json();
}

export async function deleteConversation(userId: string, id: string): Promise<void> {
  const res = await fetch(backendUrl(`/conversations/${id}`), {
    method: "DELETE",
    headers: backendHeaders(userId),
  });
  if (!res.ok) throw new Error(`Backend delete failed: ${res.status}`);
}
