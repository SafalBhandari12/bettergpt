"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react";
import { CheckIcon, CopyIcon, KeyIcon, RefreshIcon, TrashIcon } from "@/components/icons";
import { CodeWindow } from "@/components/CodeWindow";

interface KeyMeta {
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://api.bettergpt.dev/v1";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="flex items-center gap-1.5 rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium text-black hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-white/[.06]"
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function Dashboard() {
  const { user, logout } = useLoginWithChatGPT();

  const [keyMeta, setKeyMeta] = useState<KeyMeta | null | undefined>(undefined);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/keys")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load key (${res.status})`);
        return res.json() as Promise<{ key: KeyMeta | null }>;
      })
      .then((data) => {
        if (!cancelled) setKeyMeta(data.key);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load key");
        setKeyMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateOrRotate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", { method: "POST" });
      if (!res.ok) throw new Error(`Failed to create key (${res.status})`);
      const data = (await res.json()) as { key: string; prefix: string; createdAt: number };
      setRevealedKey(data.key);
      setKeyMeta({ prefix: data.prefix, createdAt: data.createdAt, lastUsedAt: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!window.confirm("Revoke this key? Anything using it will stop working immediately.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to revoke key (${res.status})`);
      setKeyMeta(null);
      setRevealedKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    } finally {
      setBusy(false);
    }
  }

  const displayKey = revealedKey ?? "sk-bettergpt-••••••••••••••••••••••••••••••••••••••••";

  const curlSample = `curl ${GATEWAY_URL}/chat/completions \\
  -H "Authorization: Bearer ${displayKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5.5",
    "messages": [{ "role": "user", "content": "Hello!" }]
  }'`;

  const pythonSample = `from openai import OpenAI

client = OpenAI(
    api_key="${displayKey}",
    base_url="${GATEWAY_URL}",
)

response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`;

  const jsSample = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${displayKey}",
  baseURL: "${GATEWAY_URL}",
});

const response = await client.chat.completions.create({
  model: "gpt-5.5",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);`;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-black">
      <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-3 dark:border-white/[.145]">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-black dark:text-zinc-50">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <KeyIcon className="h-3.5 w-3.5" />
          </span>
          BetterGPT API
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-zinc-500 sm:inline dark:text-zinc-400">
            {user?.name ?? user?.email ?? "Signed in"}
          </span>
          <button
            onClick={() => logout()}
            className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-black hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Your API key
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Use this key with the OpenAI SDK, or any OpenAI-compatible tool, pointed at{" "}
          <code className="rounded bg-black/[.05] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
            {GATEWAY_URL}
          </code>
          .
        </p>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-6 rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          {keyMeta === undefined ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : keyMeta === null && !revealedKey ? (
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                You don&rsquo;t have an API key yet.
              </p>
              <button
                onClick={handleCreateOrRotate}
                disabled={busy}
                className="flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <KeyIcon className="h-4 w-4" />
                {busy ? "Creating…" : "Create API key"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-black/[.08] bg-zinc-50 px-4 py-3 font-mono text-sm text-black dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50">
                <span className="truncate">{displayKey}</span>
                {revealedKey && <CopyButton text={revealedKey} />}
              </div>

              {revealedKey ? (
                <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-900/90 dark:bg-amber-500/10 dark:text-amber-100/80">
                  Copy this now — for your security, we won&rsquo;t show the full key again.
                </p>
              ) : (
                keyMeta && (
                  <p className="text-xs text-zinc-400">
                    Created {formatDate(keyMeta.createdAt)}
                    {keyMeta.lastUsedAt ? ` · last used ${formatDate(keyMeta.lastUsedAt)}` : " · never used yet"}
                  </p>
                )
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCreateOrRotate}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium text-black hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-white/[.06]"
                >
                  <RefreshIcon className="h-3.5 w-3.5" />
                  Regenerate
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-white/[.145] dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Revoke
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 flex flex-col gap-6">
          <h2 className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
            Use it
          </h2>
          <CodeWindow title="terminal">{curlSample}</CodeWindow>
          <CodeWindow title="python">{pythonSample}</CodeWindow>
          <CodeWindow title="typescript">{jsSample}</CodeWindow>
        </div>
      </main>
    </div>
  );
}
