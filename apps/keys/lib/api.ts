export interface KeyMeta {
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface CreatedKey {
  key: string;
  prefix: string;
  createdAt: number;
}

export async function fetchKey(): Promise<KeyMeta | null> {
  const res = await fetch("/api/keys");
  if (!res.ok) throw new Error(`Failed to load key (${res.status})`);
  const data = (await res.json()) as { key: KeyMeta | null };
  return data.key;
}

export async function createOrRotateKey(): Promise<CreatedKey> {
  const res = await fetch("/api/keys", { method: "POST" });
  if (!res.ok) throw new Error(`Failed to create key (${res.status})`);
  return res.json();
}

export async function revokeKey(): Promise<void> {
  const res = await fetch("/api/keys", { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to revoke key (${res.status})`);
}

interface PlaygroundModelsError extends Error {
  code?: string;
}

export async function fetchPlaygroundModels(): Promise<string[]> {
  const res = await fetch("/api/playground/models");
  const data = (await res.json()) as { models?: string[]; error?: string; code?: string };
  if (!res.ok) {
    const err: PlaygroundModelsError = new Error(data.error ?? `Failed to load models (${res.status})`);
    err.code = data.code;
    throw err;
  }
  return data.models ?? [];
}
