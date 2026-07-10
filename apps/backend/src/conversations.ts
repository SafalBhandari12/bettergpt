import { Hono } from "hono";
import type { Env, Variables } from "./env";
import { requireUserId } from "./middleware";

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

export const conversations = new Hono<{ Bindings: Env; Variables: Variables }>();

conversations.use("*", requireUserId);

conversations.get("/", async (c) => {
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

conversations.get("/:id", async (c) => {
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

conversations.put("/:id", async (c) => {
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

conversations.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return c.json({ ok: true });
});
