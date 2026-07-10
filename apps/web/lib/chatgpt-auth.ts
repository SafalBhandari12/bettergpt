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
 * in-process Map. A host like Vercel can route consecutive requests to
 * different serverless instances, each with its own empty in-memory store —
 * that silently "forgets" a session mid-flow (sign-in appears to work, then
 * the very next authenticated call 401s). KV is shared across instances.
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

// Falls back to the library's in-process default when the backend isn't
// configured (e.g. running `next dev` standalone, without `wrangler dev`).
const sessionStore: KeyValueStore<StoredSession> =
  process.env.BACKEND_URL && process.env.INTERNAL_SECRET
    ? kvSessionStore
    : new MemoryStore<StoredSession>();

/**
 * Single shared handler instance. The `/api/chatgpt/*` login routes and the
 * `/api/history/*` routes below must import this same instance (not each
 * construct their own) to see the same sessions.
 */
export const auth = createChatGPTHandler({
  secret: process.env.LWC_SECRET,
  sessionStore,
});
