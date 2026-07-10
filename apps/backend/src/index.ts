import { Hono } from "hono";
import { cors } from "hono/cors";

export interface Env {
  DB: D1Database;
  /** Generic key-value store, currently used to back Login with ChatGPT's
   * server-side sessions (see apps/web/lib/chatgpt-auth.ts) — that library
   * defaults to an in-process Map, which doesn't survive across the many
   * separate serverless instances a host like Vercel may route requests to. */
  SESSIONS: KVNamespace;
  /** Shared secret with the Next.js BFF — the only intended caller. */
  INTERNAL_SECRET: string;
  /** Comma-separated list of origins allowed to call this API directly
   * (browser preflight/CORS). Set in wrangler.toml `[vars]`. */
  ALLOWED_ORIGINS?: string;
}

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"];

interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  data: string;
  created_at: number;
  updated_at: number;
}

interface ConversationPayload {
  title: string;
  data: unknown;
}

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const configured = c.env.ALLOWED_ORIGINS?.split(",").map((o: string) => o.trim()) ?? [];
      const allowed = configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
      return origin && allowed.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "x-internal-secret", "x-user-id"],
    maxAge: 600,
  }),
);

app.use("*", async (c, next) => {
  const secret = c.req.header("x-internal-secret");
  if (!secret || secret !== c.env.INTERNAL_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// Registered on both the collection and item routes — Hono's "/x/*" pattern
// doesn't also match the bare "/x".
app.use("/conversations", async (c, next) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Missing x-user-id" }, 400);
  c.set("userId", userId);
  await next();
});
app.use("/conversations/*", async (c, next) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Missing x-user-id" }, 400);
  c.set("userId", userId);
  await next();
});

app.get("/conversations", async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare(
    "SELECT id, title, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
  )
    .bind(userId)
    .all<Pick<ConversationRow, "id" | "title" | "updated_at">>();

  return c.json(
    results.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at })),
  );
});

app.get("/conversations/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    "SELECT id, title, data, updated_at FROM conversations WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<Pick<ConversationRow, "id" | "title" | "data" | "updated_at">>();

  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    data: JSON.parse(row.data),
  });
});

app.put("/conversations/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<ConversationPayload>();
  if (!body || typeof body.title !== "string" || body.data === undefined) {
    return c.json({ error: "Expected { title, data }" }, 400);
  }

  const existing = await c.env.DB.prepare("SELECT user_id FROM conversations WHERE id = ?")
    .bind(id)
    .first<Pick<ConversationRow, "user_id">>();
  if (existing && existing.user_id !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO conversations (id, user_id, title, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, data = excluded.data, updated_at = excluded.updated_at`,
  )
    .bind(id, userId, body.title, JSON.stringify(body.data), now, now)
    .run();

  return c.json({ id, title: body.title, updatedAt: now });
});

app.delete("/conversations/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return c.json({ ok: true });
});

// Generic KV proxy — a durable, shared alternative to Login with ChatGPT's
// default in-memory session store. Deliberately schema-agnostic (just get
// /set/delete by key) so it isn't coupled to that library's session shape;
// apps/web/lib/chatgpt-auth.ts owns the key naming and value shape.
interface KVPutBody {
  value: unknown;
  ttlMs?: number;
}

app.get("/kv/:key", async (c) => {
  const raw = await c.env.SESSIONS.get(c.req.param("key"));
  if (raw === null) return c.json({ value: null }, 404);
  return c.json({ value: JSON.parse(raw) });
});

app.put("/kv/:key", async (c) => {
  const body = await c.req.json<KVPutBody>();
  // Workers KV requires a minimum TTL of 60s; anything shorter just rounds up
  // rather than erroring.
  const expirationTtl = body.ttlMs ? Math.max(60, Math.ceil(body.ttlMs / 1000)) : undefined;
  await c.env.SESSIONS.put(c.req.param("key"), JSON.stringify(body.value), { expirationTtl });
  return c.json({ ok: true });
});

app.delete("/kv/:key", async (c) => {
  await c.env.SESSIONS.delete(c.req.param("key"));
  return c.json({ ok: true });
});

export default app;
