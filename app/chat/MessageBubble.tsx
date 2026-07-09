"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { CopyIcon, CheckIcon, BranchIcon } from "@/components/icons";
import { useConversationStore, type ConversationNode } from "@/lib/conversation-store";

interface SelectionState {
  text: string;
  x: number;
  y: number;
}

interface MessageBubbleProps {
  message: ConversationNode;
  /**
   * Precomputed by the parent (grouped once per render over the whole tree)
   * instead of each bubble scanning every node itself — with N mounted
   * bubbles that per-bubble scan was O(N) work each, O(N^2) total on every
   * streamed token.
   */
  siblings: ConversationNode[];
  onOpenBranches: () => void;
}

function MessageBubbleImpl({ message, siblings, onOpenBranches }: MessageBubbleProps) {
  const branchFrom = useConversationStore((s) => s.branchFrom);
  const contentRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [copied, setCopied] = useState(false);

  const isUser = message.role === "user";
  const siblingIndex = siblings.findIndex((n) => n.id === message.id);
  const hasBranches = siblings.length > 1;

  // Branching from an assistant reply anchors to that reply (the new user
  // message becomes its child, a sibling of the existing continuation).
  // Branching from a user message must anchor to *its* parent instead, so
  // the new message becomes a sibling of this one — anchoring to the user
  // message itself would insert it as that message's child, i.e. two user
  // turns in a row with no assistant reply between them.
  const branchAnchorId = isUser ? (message.parentId ?? message.id) : message.id;

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text || !contentRef.current?.contains(sel.anchorNode)) {
      setSelection(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelection({ text, x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  useEffect(() => {
    if (!selection) return;
    const clearIfCollapsed = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setSelection(null);
    };
    document.addEventListener("selectionchange", clearIfCollapsed);
    return () => document.removeEventListener("selectionchange", clearIfCollapsed);
  }, [selection]);

  async function copy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const actionRow = (
    <div
      className={`mt-1 flex items-center gap-1 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <button
        onClick={copy}
        aria-label="Copy message"
        className="rounded-md p-1 hover:bg-black/[.05] hover:text-black dark:hover:bg-white/[.08] dark:hover:text-zinc-50"
      >
        {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={() => branchFrom(branchAnchorId)}
        aria-label="Branch from this message"
        className="rounded-md p-1 hover:bg-black/[.05] hover:text-black dark:hover:bg-white/[.08] dark:hover:text-zinc-50"
      >
        <BranchIcon className="h-3.5 w-3.5" />
      </button>
      {hasBranches && (
        <button
          onClick={onOpenBranches}
          className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          {siblingIndex + 1}/{siblings.length} branches
        </button>
      )}
    </div>
  );

  const bubbleContent = message.content ? (
    <Markdown content={message.content} />
  ) : (
    <span className="text-zinc-400">{message.status === "streaming" ? "Thinking…" : ""}</span>
  );

  return (
    <div className="group relative">
      {isUser ? (
        <div className="flex justify-end">
          <div className="flex max-w-[75%] flex-col items-end">
            <div
              ref={contentRef}
              onMouseUp={handleMouseUp}
              className="rounded-3xl bg-zinc-100 px-4 py-2.5 text-sm text-black dark:bg-zinc-800 dark:text-zinc-50"
            >
              {bubbleContent}
            </div>
            {actionRow}
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white">
            AI
          </div>
          <div className="min-w-0 flex-1">
            {message.model && (
              <p className="mb-1 text-xs font-medium text-zinc-400">{message.model}</p>
            )}
            <div ref={contentRef} onMouseUp={handleMouseUp} className="text-sm text-black dark:text-zinc-50">
              {bubbleContent}
              {message.status === "streaming" && message.content && (
                <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle" />
              )}
              {message.status === "error" && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Something went wrong generating this reply.
                </p>
              )}
            </div>
            {actionRow}
          </div>
        </div>
      )}

      {selection && (
        <button
          style={{ position: "fixed", left: selection.x, top: selection.y - 40, zIndex: 50 }}
          className="-translate-x-1/2 rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-zinc-50 dark:text-black"
          onMouseDown={(e) => {
            e.preventDefault();
            branchFrom(branchAnchorId, selection.text);
            window.getSelection()?.removeAllRanges();
            setSelection(null);
          }}
        >
          Branch from selection
        </button>
      )}
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
