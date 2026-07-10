"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react";
import { KeyIcon, ArrowRightIcon } from "@/components/icons";

interface Message {
  role: "user" | "assistant";
  content: string;
}

async function streamChat(
  body: { model: string; messages: Message[] },
  onDelta: (delta: string) => void,
  onError: (message: string) => void,
) {
  const res = await fetch("/api/playground/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    onError(data?.error ?? `Request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as { delta?: string; error?: string };
        if (parsed.error) onError(parsed.error);
        else if (parsed.delta) onDelta(parsed.delta);
      } catch {
        // ignore malformed chunk
      }
    }
  }
}

export function Playground() {
  const { user, logout } = useLoginWithChatGPT();

  const [ready, setReady] = useState<"loading" | "no-key" | "ready">("loading");
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/playground/models")
      .then((res) => res.json() as Promise<{ models?: string[]; error?: string }>)
      .then((data) => {
        if (cancelled) return;
        if (data.models?.length) {
          setModels(data.models);
          setModel(data.models[0]);
          setReady("ready");
        } else {
          setReady("no-key");
        }
      })
      .catch(() => {
        if (!cancelled) setReady("no-key");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || busy || !model) return;
    setError(null);
    setInput("");

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setBusy(true);

    try {
      await streamChat(
        { model, messages: nextMessages },
        (delta) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, content: last.content + delta };
            return copy;
          });
        },
        (message) => setError(message),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-black">
      <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-3 dark:border-white/[.145]">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-black dark:text-zinc-50">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <KeyIcon className="h-3.5 w-3.5" />
            </span>
            BetterGPT API
          </Link>
          <nav className="flex items-center gap-1 rounded-full bg-zinc-100 p-0.5 text-xs dark:bg-zinc-900">
            <Link href="/dashboard" className="rounded-full px-3 py-1 font-medium text-zinc-500 dark:text-zinc-400">
              Dashboard
            </Link>
            <span className="rounded-full bg-white px-3 py-1 font-medium text-black shadow-sm dark:bg-zinc-700 dark:text-zinc-50">
              Playground
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {ready === "ready" && models.length > 1 && (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-lg border border-black/[.08] bg-white px-2 py-1 text-xs text-black dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
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

      {ready === "loading" ? (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">Loading…</div>
      ) : ready === "no-key" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You need an API key before you can use the playground.
          </p>
          <Link
            href="/dashboard"
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Create your API key
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
              {messages.length === 0 ? (
                <p className="pt-16 text-center text-sm text-zinc-400">
                  Try a message — this uses your API key directly, no code required.
                </p>
              ) : (
                messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[75%] rounded-3xl bg-zinc-100 px-4 py-2.5 text-sm text-black dark:bg-zinc-800 dark:text-zinc-50">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                        AI
                      </div>
                      <div className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-black dark:text-zinc-50">
                        {m.content || (busy && i === messages.length - 1 ? "…" : "")}
                      </div>
                    </div>
                  ),
                )
              )}
              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-black/[.08] bg-white/90 px-4 py-3 backdrop-blur dark:border-white/[.145] dark:bg-black/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="mx-auto flex max-w-3xl items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send a message"
                disabled={busy}
                className="h-11 flex-1 rounded-2xl border border-black/[.08] bg-white px-4 text-sm text-black outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-black/10 disabled:opacity-60 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-white/15"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                className="flex h-11 shrink-0 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
