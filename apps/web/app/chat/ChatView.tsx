"use client";

import { useCallback, useEffect, useState } from "react";
import { streamText } from "ai";
import { createChatGPTProxyProvider } from "@opencoredev/loginwithchatgpt-ai";
import { useLoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react";
import { useConversationStore, type ConversationNode } from "@/lib/conversation-store";
import { ModelPicker } from "./ModelPicker";
import { ChatThread } from "./ChatThread";
import { BranchExplorer } from "./BranchExplorer";
import { HistorySidebar } from "./HistorySidebar";
import { PanelLeftIcon } from "@/components/icons";

const chatgpt = createChatGPTProxyProvider();

type Tab = "chat" | "branches";

/** Flattens a root→leaf path of turns into the alternating role list the model API expects. */
function pathToMessages(path: ConversationNode[]) {
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const node of path) {
    messages.push({ role: "user", content: node.prompt });
    if (node.response) messages.push({ role: "assistant", content: node.response });
  }
  return messages;
}

export function ChatView() {
  const { user, logout } = useLoginWithChatGPT();

  const currentId = useConversationStore((s) => s.currentId);
  const conversation = useConversationStore((s) =>
    s.currentId ? s.conversations[s.currentId] : null,
  );
  const newConversation = useConversationStore((s) => s.newConversation);
  const addTurn = useConversationStore((s) => s.addTurn);
  const appendResponse = useConversationStore((s) => s.appendResponse);
  const setNodeStatus = useConversationStore((s) => s.setNodeStatus);
  const getPath = useConversationStore((s) => s.getPath);

  const [tab, setTab] = useState<Tab>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Always have a conversation to write into — first load, or after the
  // last one was deleted.
  useEffect(() => {
    if (!currentId) newConversation();
  }, [currentId, newConversation]);

  useEffect(() => {
    let cancelled = false;
    chatgpt
      .listModels()
      .then((list) => {
        if (cancelled) return;
        setModels(list);
        setModel((current) => (current && list.includes(current) ? current : list[0] ?? ""));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setModelsError(err instanceof Error ? err.message : "Failed to load models.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!model || !conversation) return;
      const nodeId = addTurn(conversation.activeNodeId, text, model);
      if (!nodeId) return;
      const messages = pathToMessages(getPath(nodeId));

      setIsStreaming(true);
      // Flushing every raw delta to the store forces a full Markdown/syntax-
      // highlight re-parse of the growing message on every token (dozens of
      // times/sec). Buffer deltas and flush on a fixed interval instead —
      // still reads as live streaming, at a fraction of the render cost.
      let buffer = "";
      const flush = () => {
        if (buffer) {
          appendResponse(nodeId, buffer);
          buffer = "";
        }
      };
      const flushInterval = setInterval(flush, 60);
      try {
        const result = streamText({ model: chatgpt(model), messages });
        for await (const delta of result.textStream) {
          buffer += delta;
        }
        flush();
        setNodeStatus(nodeId, "done");
      } catch {
        flush();
        setNodeStatus(nodeId, "error");
      } finally {
        clearInterval(flushInterval);
        setIsStreaming(false);
      }
    },
    [model, conversation, addTurn, getPath, appendResponse, setNodeStatus],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-black">
      <HistorySidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-black/[.08] bg-white/90 px-3 py-2 backdrop-blur dark:border-white/[.145] dark:bg-black/80">
          <div className="flex items-center gap-1 justify-self-start">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Toggle history sidebar"
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-black/[.04] md:hidden dark:hover:bg-white/[.08]"
            >
              <PanelLeftIcon className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm font-semibold text-black dark:text-zinc-50">
              BetterGPT
            </span>
            <ModelPicker models={models} model={model} onChange={setModel} />
          </div>

          <div className="flex items-center gap-1 justify-self-center rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-900">
            <button
              onClick={() => setTab("chat")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                tab === "chat"
                  ? "bg-white text-black shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setTab("branches")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                tab === "branches"
                  ? "bg-white text-black shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              Branches
            </button>
          </div>

          <div className="flex items-center gap-2 justify-self-end">
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

        {modelsError && (
          <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {modelsError}
          </p>
        )}

        {tab === "chat" ? (
          <ChatThread
            disabled={!model || isStreaming}
            onSend={handleSend}
            onOpenBranches={() => setTab("branches")}
          />
        ) : (
          <BranchExplorer onContinueInChat={() => setTab("chat")} />
        )}
      </div>
    </div>
  );
}
