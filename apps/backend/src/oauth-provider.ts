import { createChatGPT, type ChatGPTProvider } from "@opencoredev/loginwithchatgpt-ai";
import { decryptJson, encryptJson } from "./crypto";

/**
 * Builds a ChatGPT provider (auto-refreshing) from a user's stored OAuth
 * tokens. Shared by the public /v1 gateway (which resolves a userId from an
 * API key) and /playground (which already has a trusted userId from the
 * BFF session) — both ultimately just need "this user's tokens, kept
 * fresh, wired into the AI SDK."
 */
export async function getChatGPTProviderForUser(
  db: D1Database,
  encryptionKey: string,
  userId: string,
): Promise<ChatGPTProvider | null> {
  const tokenRow = await db
    .prepare("SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE user_id = ?")
    .bind(userId)
    .first<{ access_token: string; refresh_token: string | null; expires_at: number | null }>();
  if (!tokenRow) return null;

  const accessToken = await decryptJson<string>(tokenRow.access_token, encryptionKey);
  const refreshToken = tokenRow.refresh_token
    ? await decryptJson<string>(tokenRow.refresh_token, encryptionKey)
    : undefined;

  return createChatGPT({
    credentials: { accessToken, refreshToken, accountId: userId, expiresAt: tokenRow.expires_at ?? undefined },
    onRefresh: async (fresh) => {
      const now = Date.now();
      const encAccess = await encryptJson(fresh.accessToken, encryptionKey);
      const encRefresh = fresh.refreshToken ? await encryptJson(fresh.refreshToken, encryptionKey) : null;
      await db
        .prepare(
          "UPDATE oauth_tokens SET access_token = ?, refresh_token = COALESCE(?, refresh_token), expires_at = ?, updated_at = ? WHERE user_id = ?",
        )
        .bind(encAccess, encRefresh, fresh.expiresAt ?? null, now, userId)
        .run();
    },
  });
}
