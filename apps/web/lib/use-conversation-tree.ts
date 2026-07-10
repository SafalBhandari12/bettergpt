"use client";

import { useMemo } from "react";
import { useConversationStore, type ConversationNode } from "./conversation-store";

/** Stable fallback so `nodes` doesn't get a fresh `{}` identity every render
 * while there's no current conversation yet. */
export const EMPTY_NODES: Record<string, ConversationNode> = {};

/**
 * Shared by the Chat and Branches tabs: the active path (root → focused
 * leaf) plus a parentId -> children lookup, built once per tree change
 * instead of each message bubble scanning the whole tree itself.
 */
export function useConversationTree() {
  const currentId = useConversationStore((s) => s.currentId);
  const conversation = useConversationStore((s) =>
    s.currentId ? s.conversations[s.currentId] : null,
  );
  const getPath = useConversationStore((s) => s.getPath);

  const nodes = conversation?.nodes ?? EMPTY_NODES;
  const rootId = conversation?.rootId ?? null;
  const activeNodeId = conversation?.activeNodeId ?? null;

  // `nodes` isn't read directly here, but it must stay a dependency so this
  // recomputes on every streamed token (getPath reads live store state).
  const path = useMemo(
    () => (activeNodeId ? getPath(activeNodeId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeNodeId, nodes, getPath, currentId],
  );

  const childrenByParent = useMemo(() => {
    const groups = new Map<string, ConversationNode[]>();
    for (const node of Object.values(nodes)) {
      const key = node.parentId ?? "root";
      const group = groups.get(key);
      if (group) group.push(node);
      else groups.set(key, [node]);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => a.createdAt - b.createdAt);
    }
    return groups;
  }, [nodes]);

  function siblingsOf(message: ConversationNode): ConversationNode[] {
    return childrenByParent.get(message.parentId ?? "root") ?? [message];
  }

  return { rootId, nodes, path, siblingsOf };
}
