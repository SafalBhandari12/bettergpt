import { Hono } from "hono";
import type { Env, Variables } from "./env";

// Generic KV proxy — a durable, shared alternative to Login with ChatGPT's
// default in-memory session store. Deliberately schema-agnostic (just
// get/set/delete by key) so it isn't coupled to that library's session
// shape; the BFF (apps/web|apps/keys lib/chatgpt-auth.ts) owns the key
// naming and value shape.
interface KVPutBody {
  value: unknown;
  ttlMs?: number;
}

export const kv = new Hono<{ Bindings: Env; Variables: Variables }>();

kv.get("/:key", async (c) => {
  const raw = await c.env.SESSIONS.get(c.req.param("key"));
  if (raw === null) return c.json({ value: null }, 404);
  return c.json({ value: JSON.parse(raw) });
});

kv.put("/:key", async (c) => {
  const body = await c.req.json<KVPutBody>();
  // Workers KV requires a minimum TTL of 60s; anything shorter just rounds up
  // rather than erroring.
  const expirationTtl = body.ttlMs ? Math.max(60, Math.ceil(body.ttlMs / 1000)) : undefined;
  await c.env.SESSIONS.put(c.req.param("key"), JSON.stringify(body.value), { expirationTtl });
  return c.json({ ok: true });
});

kv.delete("/:key", async (c) => {
  await c.env.SESSIONS.delete(c.req.param("key"));
  return c.json({ ok: true });
});
