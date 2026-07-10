import {
  createChatGPTHandler,
  MemoryStore,
  type KeyValueStore,
  type StoredSession,
} from "@opencoredev/loginwithchatgpt-server";

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

/**
 * Backs sessions with the Cloudflare Worker's KV store instead of an
 * in-process Map — see apps/web/lib/chatgpt-auth.ts for why (a host like
 * Vercel can route requests to different serverless instances, each with
 * its own empty in-memory store).
 */
const kvSessionStore: KeyValueStore<StoredSession> = {
  async get(key) {
    const res = await fetch(backendUrl(`/kv/${encodeURIComponent(key)}`), {
      headers: backendHeaders(),
      cache: "no-store",
    });
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`Session store get failed: ${res.status}`);
    const { value } = (await res.json()) as { value: StoredSession | null };
    return value ?? undefined;
  },
  async set(key, value, options) {
    const res = await fetch(backendUrl(`/kv/${encodeURIComponent(key)}`), {
      method: "PUT",
      headers: backendHeaders(),
      body: JSON.stringify({ value, ttlMs: options?.ttlMs }),
    });
    if (!res.ok) throw new Error(`Session store set failed: ${res.status}`);
  },
  async delete(key) {
    const res = await fetch(backendUrl(`/kv/${encodeURIComponent(key)}`), {
      method: "DELETE",
      headers: backendHeaders(),
    });
    if (!res.ok) throw new Error(`Session store delete failed: ${res.status}`);
  },
};

const sessionStore: KeyValueStore<StoredSession> =
  process.env.BACKEND_URL && process.env.INTERNAL_SECRET
    ? kvSessionStore
    : new MemoryStore<StoredSession>();

/**
 * This app's whole purpose is minting an API key that stands in for the
 * user's ChatGPT session indefinitely, so — unlike apps/web — it genuinely
 * needs raw token export: `dangerouslyGetTokens()` is how /api/keys hands
 * the access+refresh tokens to the backend to store (encrypted) against the
 * new key.
 */
export const auth = createChatGPTHandler({
  secret: process.env.LWC_SECRET,
  sessionStore,
  dangerouslyAllowTokenExport: true,
  dangerouslyAllowRefreshTokenExport: true,
});
