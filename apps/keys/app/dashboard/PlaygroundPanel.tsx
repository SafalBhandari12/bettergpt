"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPlaygroundModels } from "@/lib/api";

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

interface PlaygroundPanelProps {
  hasKey: boolean;
}

export function PlaygroundPanel({ hasKey }: PlaygroundPanelProps) {
  const modelsQuery = useQuery({
    queryKey: ["playground-models"],
    queryFn: fetchPlaygroundModels,
    enabled: hasKey,
    retry: false,
  });

  const models = modelsQuery.data ?? [];
  const [modelOverride, setModelOverride] = useState<string | null>(null);
  const model = modelOverride ?? models[0] ?? "";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/[.08] bg-white dark:border-white/[.145] dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-black/[.08] px-4 py-3 dark:border-white/[.145]">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Playground</h2>
        {models.length > 1 && (
          <select
            value={model}
            onChange={(e) => setModelOverride(e.target.value)}
            className="rounded-lg border border-black/[.08] bg-white px-2 py-1 text-xs text-black dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      {!hasKey ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-zinc-400">
          Create an API key above to try it here.
        </div>
      ) : modelsQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">Loading…</div>
      ) : modelsQuery.isError ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-red-600 dark:text-red-400">
          {modelsQuery.error instanceof Error ? modelsQuery.error.message : "Failed to load models."}
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-4 px-4 py-4">
              {messages.length === 0 ? (
                <p className="pt-10 text-center text-xs text-zinc-400">
                  Try a message — this uses your key directly, no code required.
                </p>
              ) : (
                messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-black dark:bg-zinc-800 dark:text-zinc-50">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
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
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                  {error}
                </p>
              )}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-black/[.08] p-3 dark:border-white/[.145]"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send a message"
              disabled={busy}
              className="h-9 flex-1 rounded-xl border border-black/[.08] bg-white px-3 text-sm text-black outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-black/10 disabled:opacity-60 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-white/15"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="flex h-9 shrink-0 items-center justify-center rounded-xl bg-accent px-4 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
