"use client";

import { useConversationTree } from "@/lib/use-conversation-tree";
import { BranchGraph } from "./BranchGraph";

export function BranchExplorer({ onContinueInChat }: { onContinueInChat: () => void }) {
  const { rootId } = useConversationTree();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="border-b border-black/[.08] bg-zinc-50 px-4 py-2.5 text-center text-xs leading-5 text-zinc-500 dark:border-white/[.145] dark:bg-zinc-950 dark:text-zinc-400">
        Click a node to switch your active branch (highlighted in green). Drag the violet dot on
        a node&rsquo;s edge onto another node to merge those branches together.
      </p>

      <BranchGraph />

      {rootId && (
        <div className="flex justify-center border-t border-black/[.08] bg-white/90 px-4 py-3 backdrop-blur dark:border-white/[.145] dark:bg-black/80">
          <button
            onClick={onContinueInChat}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Continue this branch in Chat
          </button>
        </div>
      )}
    </div>
  );
}
