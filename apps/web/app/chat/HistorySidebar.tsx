"use client";

import { useConversationStore } from "@/lib/conversation-store";
import { useHistorySync, type HistoryItem } from "@/lib/use-history-sync";
import { PlusIcon, TrashIcon, CloseIcon } from "@/components/icons";

function relativeTime(ts: number): string {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(ts).toLocaleDateString();
}

interface HistorySidebarProps {
  open: boolean;
  onClose: () => void;
}

export function HistorySidebar({ open, onClose }: HistorySidebarProps) {
  const currentId = useConversationStore((s) => s.currentId);
  const conversations = useConversationStore((s) => s.conversations);
  const newConversation = useConversationStore((s) => s.newConversation);
  const switchConversation = useConversationStore((s) => s.switchConversation);
  const deleteConversation = useConversationStore((s) => s.deleteConversation);
  const { items, loadingId, load, remove } = useHistorySync();

  const current = currentId ? conversations[currentId] : null;

  function handleNewChat() {
    // Avoid piling up empty scratch conversations if already on a fresh one.
    if (!current || current.rootId) newConversation();
    onClose();
  }

  async function handleSelect(item: HistoryItem) {
    if (!item.isLocal) {
      const ok = await load(item.id);
      if (!ok) return;
    }
    switchConversation(item.id);
    onClose();
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    deleteConversation(id);
    remove(id);
  }

  const body = (
    <div className="flex h-full w-64 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="flex items-center gap-2 p-2">
        <button
          onClick={handleNewChat}
          className="flex flex-1 items-center gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm font-medium text-black hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-white/[.06]"
        >
          <PlusIcon className="h-4 w-4" />
          New chat
        </button>
        <button
          onClick={onClose}
          aria-label="Close sidebar"
          className="rounded-lg p-2 text-zinc-500 hover:bg-black/[.04] md:hidden dark:hover:bg-white/[.08]"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        History
      </p>
      <nav className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {items.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-zinc-400">No conversations yet</p>
        )}
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelect(c)}
            disabled={loadingId === c.id}
            className={`group mb-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm disabled:opacity-60 ${
              c.id === currentId
                ? "bg-zinc-200/70 text-black dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate">{c.title}</span>
              <span className="block truncate text-[11px] text-zinc-400">
                {loadingId === c.id ? "Loading…" : relativeTime(c.updatedAt)}
              </span>
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => handleDelete(e, c.id)}
              aria-label="Delete conversation"
              className="shrink-0 rounded-md p-1 text-zinc-400 opacity-0 hover:bg-black/[.08] hover:text-red-600 group-hover:opacity-100 dark:hover:bg-white/[.1] dark:hover:text-red-400"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      <div className="hidden shrink-0 border-r border-black/[.08] md:block dark:border-white/[.145]">
        {body}
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
          <div className="absolute inset-y-0 left-0 border-r border-black/[.08] dark:border-white/[.145]">
            {body}
          </div>
        </div>
      )}
    </>
  );
}
