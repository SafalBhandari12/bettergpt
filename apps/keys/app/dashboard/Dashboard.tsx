"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChatGPTUser } from "@opencoredev/loginwithchatgpt-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, CopyIcon, KeyIcon, TrashIcon } from "@/components/icons";
import { CodeWindow } from "@/components/CodeWindow";
import { createKey, fetchKeys, revokeKey } from "@/lib/api";
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

interface DashboardProps {
  user?: ChatGPTUser;
  logout: () => Promise<void>;
}

interface RevealedKey {
  id: string;
  key: string;
}

export function Dashboard({ user, logout }: DashboardProps) {
  const queryClient = useQueryClient();

  const [revealedKey, setRevealedKey] = useState<RevealedKey | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const keysQuery = useQuery({ queryKey: ["keys"], queryFn: fetchKeys });

  const createMutation = useMutation({
    mutationFn: createKey,
    onSuccess: (data) => {
      setRevealedKey({ id: data.id, key: data.key });
      queryClient.setQueryData(["keys"], (existing: typeof keysQuery.data) => [
        { id: data.id, prefix: data.prefix, createdAt: data.createdAt, lastUsedAt: null },
        ...(existing ?? []),
      ]);
      queryClient.invalidateQueries({ queryKey: ["playground-models"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeKey,
    onSuccess: (_, id) => {
      setRevealedKey((current) => (current?.id === id ? null : current));
      queryClient.setQueryData(["keys"], (existing: typeof keysQuery.data) =>
        (existing ?? []).filter((k) => k.id !== id),
      );
      queryClient.invalidateQueries({ queryKey: ["playground-models"] });
    },
    onSettled: () => setRevokingId(null),
  });

  function handleRevoke(id: string) {
    if (!window.confirm("Revoke this key? Anything using it will stop working immediately.")) return;
    setRevokingId(id);
    revokeMutation.mutate(id);
  }

  const keys = keysQuery.data ?? [];
  const busy = createMutation.isPending || revokeMutation.isPending;
  const error =
    (keysQuery.error instanceof Error ? keysQuery.error.message : null) ??
    (createMutation.error instanceof Error ? createMutation.error.message : null) ??
    (revokeMutation.error instanceof Error ? revokeMutation.error.message : null);

  const displayKey = revealedKey?.key ?? "sk-milepost-••••••••••••••••••••••••••••••••••••••••";

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
          Mile-Post
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
            Your API keys
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Use a key with the OpenAI SDK, or any OpenAI-compatible tool, pointed at{" "}
            <code className="rounded bg-black/[.05] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
              {GATEWAY_URL}
            </code>
            . Create as many as you need — regenerating or revoking one never affects the others.
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {keysQuery.isLoading ? (
              <div className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
                <p className="text-sm text-zinc-400">Loading…</p>
              </div>
            ) : (
              <>
                {keys.length === 0 && (
                  <div className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      You don&rsquo;t have an API key yet.
                    </p>
                  </div>
                )}

                {keys.map((k) => {
                  const isRevealed = revealedKey?.id === k.id;
                  const shownValue = isRevealed ? revealedKey.key : `${k.prefix}…`;
                  return (
                    <div
                      key={k.id}
                      className="flex flex-col gap-3 rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
                    >
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-black/[.08] bg-zinc-50 px-4 py-3 font-mono text-sm text-black dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50">
                        <span className="truncate">{shownValue}</span>
                        {isRevealed && <CopyButton text={revealedKey.key} />}
                      </div>

                      {isRevealed ? (
                        <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-900/90 dark:bg-amber-500/10 dark:text-amber-100/80">
                          Copy this now — for your security, we won&rsquo;t show the full key again.
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-400">
                          Created {formatDate(k.createdAt)}
                          {k.lastUsedAt ? ` · last used ${formatDate(k.lastUsedAt)}` : " · never used yet"}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleRevoke(k.id)}
                          disabled={busy}
                          className="flex items-center gap-1.5 rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-white/[.145] dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          {revokeMutation.isPending && revokingId === k.id ? "Revoking…" : "Revoke"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={() => createMutation.mutate()}
                  disabled={busy}
                  className="flex h-11 items-center justify-center gap-2 self-start rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <KeyIcon className="h-4 w-4" />
                  {createMutation.isPending
                    ? "Creating…"
                    : keys.length === 0
                      ? "Create API key"
                      : "Create another key"}
                </button>
              </>
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
          <PlaygroundPanel hasKey={keys.length > 0} />
        </div>
      </div>
    </div>
  );
}
