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
  const conversation = useConversationStore((s) =>
    s.currentId ? s.conversations[s.currentId] : null,
  );
  const activeNodeId = conversation?.activeNodeId ?? null;
  const nodes = conversation?.nodes ?? {};

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

  // Auto-grow the textarea with content, capped by max-h-40 in the className below.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

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
          Replying in branch: {activeNode.prompt.slice(0, 80) || "New conversation"}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mx-auto flex max-w-3xl items-center gap-2"
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
          className="no-scrollbar max-h-40 flex-1 resize-none overflow-y-auto rounded-2xl border border-black/[.08] bg-white px-4 py-2.5 text-sm text-black outline-none transition-shadow placeholder:text-zinc-400 focus:ring-2 focus:ring-black/10 disabled:opacity-60 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-white/15"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="h-11 shrink-0 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          Send
        </button>
      </form>
    </div>
  );
});
