"use client";

import { useEffect, useRef } from "react";
import { useConversationTree } from "@/lib/use-conversation-tree";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";

interface ChatThreadProps {
  disabled: boolean;
  onSend: (text: string) => void;
  onOpenBranches: () => void;
}

export function ChatThread({ disabled, onSend, onOpenBranches }: ChatThreadProps) {
  const { rootId, path, siblingsOf } = useConversationTree();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [path]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function handleSend(text: string) {
    stickToBottom.current = true;
    onSend(text);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
          {!rootId ? (
            <p className="pt-16 text-center text-sm text-zinc-400">
              Send a message to start. Hover any reply to branch it, or highlight text to branch
              from that exact point.
            </p>
          ) : (
            path.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                siblings={siblingsOf(message)}
                onOpenBranches={onOpenBranches}
              />
            ))
          )}
        </div>
      </div>

      <Composer disabled={disabled} onSend={handleSend} />
    </div>
  );
}
