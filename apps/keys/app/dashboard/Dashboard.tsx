"use client";

import { useState } from "react";
import Link from "next/link";
import { useLoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, CopyIcon, KeyIcon, RefreshIcon, TrashIcon } from "@/components/icons";
import { CodeWindow } from "@/components/CodeWindow";
import { createOrRotateKey, fetchKey, revokeKey, type KeyMeta } from "@/lib/api";
import { PlaygroundPanel } from "./PlaygroundPanel";

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
  const queryClient = useQueryClient();

  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const keyQuery = useQuery({ queryKey: ["key"], queryFn: fetchKey });

  const createMutation = useMutation({
    mutationFn: createOrRotateKey,
    onSuccess: (data) => {
      setRevealedKey(data.key);
      const meta: KeyMeta = { prefix: data.prefix, createdAt: data.createdAt, lastUsedAt: null };
      queryClient.setQueryData(["key"], meta);
      queryClient.invalidateQueries({ queryKey: ["playground-models"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeKey,
    onSuccess: () => {
      setRevealedKey(null);
      queryClient.setQueryData(["key"], null);
      queryClient.invalidateQueries({ queryKey: ["playground-models"] });
    },
  });

  function handleRevoke() {
    if (!window.confirm("Revoke this key? Anything using it will stop working immediately.")) return;
    revokeMutation.mutate();
  }

  const keyMeta = keyQuery.data;
  const busy = createMutation.isPending || revokeMutation.isPending;
  const error =
    (keyQuery.error instanceof Error ? keyQuery.error.message : null) ??
    (createMutation.error instanceof Error ? createMutation.error.message : null) ??
    (revokeMutation.error instanceof Error ? revokeMutation.error.message : null);

  const displayKey = revealedKey ?? "sk-gptbridge-••••••••••••••••••••••••••••••••••••••••";

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
    <div className="flex h-screen flex-col bg-white dark:bg-black">
      <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-3 dark:border-white/[.145]">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-black dark:text-zinc-50">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <KeyIcon className="h-3.5 w-3.5" />
          </span>
          GPTBridge
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[1fr_380px]">
        <div className="thin-scrollbar min-h-0 overflow-y-auto pr-1">
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
            {keyQuery.isLoading ? (
              <p className="text-sm text-zinc-400">Loading…</p>
            ) : !keyMeta && !revealedKey ? (
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  You don&rsquo;t have an API key yet.
                </p>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={busy}
                  className="flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <KeyIcon className="h-4 w-4" />
                  {createMutation.isPending ? "Creating…" : "Create API key"}
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
                    onClick={() => createMutation.mutate()}
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

          <div className="mt-12 flex flex-col gap-6 pb-6">
            <h2 className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
              Use it
            </h2>
            <CodeWindow title="terminal">{curlSample}</CodeWindow>
            <CodeWindow title="python">{pythonSample}</CodeWindow>
            <CodeWindow title="typescript">{jsSample}</CodeWindow>
          </div>
        </div>

        <div className="min-h-0">
          <PlaygroundPanel hasKey={Boolean(keyMeta)} />
        </div>
      </div>
    </div>
  );
}
