"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useConversationStore } from "@/lib/conversation-store";

export interface ComposerHandle {
  focus: () => void;
}

interface ComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { disabled, onSend },
  ref,
) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingQuote = useConversationStore((s) => s.pendingQuote);
  const clearPendingQuote = useConversationStore((s) => s.clearPendingQuote);
  const activeNodeId = useConversationStore((s) => s.activeNodeId);
  const nodes = useConversationStore((s) => s.nodes);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  useEffect(() => {
    if (pendingQuote) {
      setValue((prev) => (prev ? prev : `> ${pendingQuote.replace(/\n/g, "\n> ")}\n\n`));
      textareaRef.current?.focus();
      clearPendingQuote();
    }
  }, [pendingQuote, clearPendingQuote]);

  const activeNode = activeNodeId ? nodes[activeNodeId] : null;

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    onSend(text);
  }

  return (
    <div className="border-t border-black/[.08] bg-white/90 px-4 py-3 backdrop-blur dark:border-white/[.145] dark:bg-black/80">
      {activeNode && (
        <p className="mb-2 truncate text-xs text-zinc-400">
          Replying in branch: {activeNode.content.slice(0, 80) || "New conversation"}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mx-auto flex max-w-3xl gap-2"
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={disabled ? "Loading models…" : "Send a message"}
          disabled={disabled}
          className="max-h-40 flex-1 resize-none rounded-2xl border border-black/[.08] bg-white px-4 py-2.5 text-sm text-black outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          Send
        </button>
      </form>
    </div>
  );
});
