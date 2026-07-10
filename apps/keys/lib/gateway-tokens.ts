import { createChatGPT, type ChatGPTProvider } from "@opencoredev/loginwithchatgpt-ai";

/**
 * Builds a ChatGPT provider from a user's tokens (resolved via the Worker's
 * /internal token-storage API), wiring token refresh to persist back there.
 * The actual Codex network call happens here, in this Vercel-hosted route —
 * not in the Worker. See apps/backend/src/internal-tokens.ts for why: a
 * Cloudflare Worker calling chatgpt.com (also Cloudflare-fronted) trips
 * OpenAI's bot protection.
 */

interface ResolvedTokens {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

function backendUrl(path: string): string {
  const base = process.env.BACKEND_URL;
  if (!base) throw new Error("BACKEND_URL is not configured");
  return `${base}${path}`;
}

function backendHeaders(): HeadersInit {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) throw new Error("INTERNAL_SECRET is not configured");
  return { "x-internal-secret": secret, "content-type": "application/json" };
}

/** Resolves a plaintext sk- API key to its owner's tokens. Used by /v1/*. */
export async function resolveTokensByKey(key: string): Promise<ResolvedTokens | null> {
  const res = await fetch(backendUrl("/internal/resolve-key"), {
    method: "POST",
    headers: backendHeaders(),
    body: JSON.stringify({ key }),
  });
  if (!res.ok) return null;
  return res.json();
}

/** Resolves a trusted (already session-validated) userId to their tokens. Used by /playground. */
export async function resolveTokensByUserId(userId: string): Promise<ResolvedTokens | null> {
  const res = await fetch(backendUrl(`/internal/by-user/${encodeURIComponent(userId)}`), {
    headers: backendHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function persistRefreshedTokens(
  userId: string,
  tokens: { accessToken: string; refreshToken?: string; expiresAt?: number },
): Promise<void> {
  await fetch(backendUrl(`/internal/by-user/${encodeURIComponent(userId)}`), {
    method: "PUT",
    headers: backendHeaders(),
    body: JSON.stringify(tokens),
  });
}

export function buildProvider(resolved: ResolvedTokens): ChatGPTProvider {
  return createChatGPT({
    credentials: {
      accessToken: resolved.accessToken,
      refreshToken: resolved.refreshToken,
      accountId: resolved.userId,
      expiresAt: resolved.expiresAt,
    },
    onRefresh: (fresh) => persistRefreshedTokens(resolved.userId, fresh),
  });
}
