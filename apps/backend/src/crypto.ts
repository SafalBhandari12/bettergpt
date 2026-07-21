/**
 * Web Crypto helpers (portable to Cloudflare Workers) for encrypting OAuth
 * tokens at rest and hashing API keys. Self-contained rather than importing
 * @opencoredev/loginwithchatgpt-server's equivalent helpers, to keep this
 * Worker's only dependency on that ecosystem the small, framework-agnostic
 * -core and -ai packages it actually needs for the gateway.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypts a JSON-serializable value to an `iv.ciphertext` base64url string. */
export async function encryptJson(value: unknown, secret: string): Promise<string> {
  const key = await aesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

/** Decrypts a value produced by {@link encryptJson}. */
export async function decryptJson<T>(payload: string, secret: string): Promise<T> {
  const [ivPart, dataPart] = payload.split(".");
  const key = await aesKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(dataPart),
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** A new API key: `sk-milepost-<48 hex chars>`, plus the prefix safe to display. */
export function randomApiKey(): { plaintext: string; prefix: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plaintext = `sk-milepost-${token}`;
  const prefix = `${plaintext.slice(0, 18)}…`;
  return { plaintext, prefix };
}
