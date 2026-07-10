import { Hono } from "hono";
import type { Env, Variables } from "./env";
import { decryptJson, encryptJson, sha256Hex } from "./crypto";

/**
 * Pure storage API for OAuth tokens — no AI SDK, no outbound calls to
 * OpenAI. The actual Codex requests happen in apps/keys (Vercel), not here:
 * a Cloudflare Worker calling chatgpt.com (also Cloudflare-fronted) trips
 * OpenAI's bot protection, which flags traffic that originates from
 * Cloudflare's own edge network hitting another Cloudflare-protected
 * origin. This Worker only ever encrypts, stores, and looks up tokens.
 */
export const internalTokens = new Hono<{ Bindings: Env; Variables: Variables }>();

interface TokenRow {
  access_token: string;
  refresh_token: string | null;
  expires_at: number | null;
}

async function decryptTokenRow(row: TokenRow, encryptionKey: string) {
  return {
    accessToken: await decryptJson<string>(row.access_token, encryptionKey),
    refreshToken: row.refresh_token ? await decryptJson<string>(row.refresh_token, encryptionKey) : undefined,
    expiresAt: row.expires_at ?? undefined,
  };
}

// Resolves a plaintext API key (never a hash — hashing happens here, so the
// raw key never sits in a URL/query string or access log) to its owner's
// decrypted tokens.
internalTokens.post("/resolve-key", async (c) => {
  const { key } = await c.req.json<{ key: string }>();
  if (!key) return c.json({ error: "Expected { key }" }, 400);

  const keyHash = await sha256Hex(key);
  const keyRow = await c.env.DB.prepare(
    "SELECT user_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL",
  )
    .bind(keyHash)
    .first<{ user_id: string }>();
  if (!keyRow) return c.json({ error: "Invalid API key" }, 404);

  const tokenRow = await c.env.DB.prepare(
    "SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE user_id = ?",
  )
    .bind(keyRow.user_id)
    .first<TokenRow>();
  if (!tokenRow) return c.json({ error: "No ChatGPT session linked to this key" }, 404);

  await c.env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?")
    .bind(Date.now(), keyHash)
    .run();

  return c.json({ userId: keyRow.user_id, ...(await decryptTokenRow(tokenRow, c.env.TOKEN_ENCRYPTION_KEY)) });
});

// By a trusted userId (the caller — apps/keys — already resolved this from
// a validated session cookie). Used by the playground.
internalTokens.get("/by-user/:userId", async (c) => {
  const userId = c.req.param("userId");
  const tokenRow = await c.env.DB.prepare(
    "SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE user_id = ?",
  )
    .bind(userId)
    .first<TokenRow>();
  if (!tokenRow) return c.json({ error: "No API key set up yet" }, 404);

  return c.json({ userId, ...(await decryptTokenRow(tokenRow, c.env.TOKEN_ENCRYPTION_KEY)) });
});

// Persists tokens rotated by ensureFreshTokens.
internalTokens.put("/by-user/:userId", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json<{ accessToken: string; refreshToken?: string; expiresAt?: number }>();
  if (!body?.accessToken) return c.json({ error: "Expected { accessToken, ... }" }, 400);

  const now = Date.now();
  const encAccess = await encryptJson(body.accessToken, c.env.TOKEN_ENCRYPTION_KEY);
  const encRefresh = body.refreshToken ? await encryptJson(body.refreshToken, c.env.TOKEN_ENCRYPTION_KEY) : null;
  await c.env.DB.prepare(
    "UPDATE oauth_tokens SET access_token = ?, refresh_token = COALESCE(?, refresh_token), expires_at = ?, updated_at = ? WHERE user_id = ?",
  )
    .bind(encAccess, encRefresh, body.expiresAt ?? null, now, userId)
    .run();

  return c.json({ ok: true });
});
