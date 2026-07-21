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
  const { results } = await c.env.DB.prepare(
    "SELECT id, key_prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC",
  )
    .bind(userId)
    .all<{ id: string; key_prefix: string; created_at: number; last_used_at: number | null }>();

  return c.json({
    keys: results.map((row) => ({
      id: row.id,
      prefix: row.key_prefix,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    })),
  });
});

// Creates a new key for the caller, alongside any existing ones — a user can
// hold multiple concurrent keys, and creating one never touches the others.
// Always re-supplied fresh OAuth tokens from the current browser session
// (the dashboard fetches them right before calling this), since this is
// also how we (re-)link tokens for the account.
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

  const { plaintext, prefix } = randomApiKey();
  const keyHash = await sha256Hex(plaintext);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO api_keys (id, user_id, key_hash, key_prefix, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, userId, keyHash, prefix, now)
    .run();

  // The plaintext key is returned exactly once — only its prefix and hash
  // are ever stored.
  return c.json({ key: plaintext, id, prefix, createdAt: now });
});

// Revokes a single key by id. Other keys belonging to the user, and the
// linked OAuth tokens they all share, are untouched.
keys.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = await c.env.DB.prepare(
    "UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
  )
    .bind(Date.now(), id, userId)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "Key not found" }, 404);
  return c.json({ ok: true });
});
