export interface Env {
  DB: D1Database;
  /** Generic key-value store, used to back Login with ChatGPT's server-side
   * sessions (see apps/web|apps/keys lib/chatgpt-auth.ts) and, separately,
   * to hold nothing gateway-specific — API keys/tokens live in D1. */
  SESSIONS: KVNamespace;
  /** Shared secret with the Next.js BFFs (apps/web, apps/keys) — the only
   * intended callers of the non-/v1 routes. */
  INTERNAL_SECRET: string;
  /** Encrypts OAuth tokens at rest in D1 (see src/crypto.ts). */
  TOKEN_ENCRYPTION_KEY: string;
  /** Comma-separated list of origins allowed to call this API directly
   * (browser preflight/CORS). Set in wrangler.toml `[vars]`. */
  ALLOWED_ORIGINS?: string;
}

export type Variables = { userId: string };
