import { Hono } from "hono";
import type { Env, Variables } from "./env";
import { requireUserId } from "./middleware";
import { encryptJson, randomApiKey, sha256Hex } from "./crypto";

interface TokensPayload {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
}

interface CreateKeyBody {
  tokens: TokensPayload;
}

export const keys = new Hono<{ Bindings: Env; Variables: Variables }>();

keys.use("*", requireUserId);

keys.get("/", async (c) => {
  const userId = c.get("userId");
  const row = await c.env.DB.prepare(
    "SELECT key_prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? AND revoked_at IS NULL",
  )
    .bind(userId)
    .first<{ key_prefix: string; created_at: number; last_used_at: number | null }>();

  if (!row) return c.json({ key: null });
  return c.json({
    key: { prefix: row.key_prefix, createdAt: row.created_at, lastUsedAt: row.last_used_at },
  });
});

// Creates or rotates the caller's key. Always re-supplied fresh OAuth tokens
// from the current browser session (the dashboard fetches them right before
// calling this), since generating a key is also how we (re-)link tokens.
keys.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<CreateKeyBody>();
  if (!body?.tokens?.accessToken) {
    return c.json({ error: "Expected { tokens: { accessToken, ... } }" }, 400);
  }

  const now = Date.now();
  const encAccess = await encryptJson(body.tokens.accessToken, c.env.TOKEN_ENCRYPTION_KEY);
  const encRefresh = body.tokens.refreshToken
    ? await encryptJson(body.tokens.refreshToken, c.env.TOKEN_ENCRYPTION_KEY)
    : null;
  const encIdToken = body.tokens.idToken
    ? await encryptJson(body.tokens.idToken, c.env.TOKEN_ENCRYPTION_KEY)
    : null;

  await c.env.DB.prepare(
    `INSERT INTO oauth_tokens (user_id, access_token, refresh_token, id_token, expires_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       id_token = excluded.id_token,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`,
  )
    .bind(userId, encAccess, encRefresh, encIdToken, body.tokens.expiresAt ?? null, now)
    .run();

  // One active key per user — rotating replaces the previous one outright,
  // matching the "regenerate invalidates the old key" pattern of most
  // API-key dashboards.
  await c.env.DB.prepare("DELETE FROM api_keys WHERE user_id = ?").bind(userId).run();
  const { plaintext, prefix } = randomApiKey();
  const keyHash = await sha256Hex(plaintext);
  await c.env.DB.prepare(
    "INSERT INTO api_keys (id, user_id, key_hash, key_prefix, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), userId, keyHash, prefix, now)
    .run();

  // The plaintext key is returned exactly once — only its prefix and hash
  // are ever stored.
  return c.json({ key: plaintext, prefix, createdAt: now });
});

keys.delete("/", async (c) => {
  const userId = c.get("userId");
  await c.env.DB.prepare("DELETE FROM api_keys WHERE user_id = ?").bind(userId).run();
  await c.env.DB.prepare("DELETE FROM oauth_tokens WHERE user_id = ?").bind(userId).run();
  return c.json({ ok: true });
});
