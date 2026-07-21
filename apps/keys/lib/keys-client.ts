/**
 * Server-only client for the Cloudflare Worker backend's /keys routes.
 * Only imported from Next.js route handlers, which have already resolved
 * the caller's ChatGPT session into an accountId.
 */

import { auth } from "@/lib/chatgpt-auth";

export async function requireAccountId(request: Request): Promise<string | null> {
  const session = await auth.getSession(request);
  if (session.status !== "authenticated" || !session.user) return null;
  return session.user.accountId;
}

export interface RemoteKeyMeta {
  id: string;
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface TokensPayload {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
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

export async function getKeys(userId: string): Promise<RemoteKeyMeta[]> {
  const res = await fetch(backendUrl("/keys"), {
    headers: backendHeaders(userId),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Backend get keys failed: ${res.status}`);
  const { keys } = (await res.json()) as { keys: RemoteKeyMeta[] };
  return keys;
}

export async function createKey(
  userId: string,
  tokens: TokensPayload,
): Promise<{ key: string; id: string; prefix: string; createdAt: number }> {
  const res = await fetch(backendUrl("/keys"), {
    method: "POST",
    headers: backendHeaders(userId),
    body: JSON.stringify({ tokens }),
  });
  if (!res.ok) throw new Error(`Backend create key failed: ${res.status}`);
  return res.json();
}

export async function revokeKey(userId: string, keyId: string): Promise<void> {
  const res = await fetch(backendUrl(`/keys/${encodeURIComponent(keyId)}`), {
    method: "DELETE",
    headers: backendHeaders(userId),
  });
  if (!res.ok) throw new Error(`Backend revoke key failed: ${res.status}`);
}
