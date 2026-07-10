-- Backs the "sign in with ChatGPT, get an OpenAI-compatible API key" product
-- (apps/keys): a user's ChatGPT OAuth tokens, and the API key(s) that map
-- back to them for the public /v1 gateway.

CREATE TABLE oauth_tokens (
  user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,   -- AES-GCM encrypted (see src/crypto.ts)
  refresh_token TEXT,           -- encrypted, nullable
  id_token TEXT,                -- encrypted, nullable
  expires_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);

CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_user ON api_keys (user_id);
