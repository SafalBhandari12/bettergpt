/**
 * Server-only client for the Cloudflare Worker backend's /keys routes.
 * Only imported from Next.js route handlers, which have already resolved
 * the caller's ChatGPT session into an accountId.
 */

export interface RemoteKeyMeta {
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

export async function getKey(userId: string): Promise<RemoteKeyMeta | null> {
  const res = await fetch(backendUrl("/keys"), {
    headers: backendHeaders(userId),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Backend get key failed: ${res.status}`);
  const { key } = (await res.json()) as { key: RemoteKeyMeta | null };
  return key;
}

export async function createOrRotateKey(
  userId: string,
  tokens: TokensPayload,
): Promise<{ key: string; prefix: string; createdAt: number }> {
  const res = await fetch(backendUrl("/keys"), {
    method: "POST",
    headers: backendHeaders(userId),
    body: JSON.stringify({ tokens }),
  });
  if (!res.ok) throw new Error(`Backend create key failed: ${res.status}`);
  return res.json();
}

export async function revokeKey(userId: string): Promise<void> {
  const res = await fetch(backendUrl("/keys"), {
    method: "DELETE",
    headers: backendHeaders(userId),
  });
  if (!res.ok) throw new Error(`Backend revoke key failed: ${res.status}`);
}
