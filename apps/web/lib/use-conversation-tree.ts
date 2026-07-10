"use client";

import { useMemo } from "react";
import { useConversationStore, type ConversationNode } from "./conversation-store";

/**
 * Shared by the Chat and Branches tabs: the active path (root → focused
 * leaf) plus a parentId -> children lookup, built once per tree change
 * instead of each message bubble scanning the whole tree itself.
 */
export function useConversationTree() {
  const nodes = useConversationStore((s) => s.nodes);
  const rootId = useConversationStore((s) => s.rootId);
  const activeNodeId = useConversationStore((s) => s.activeNodeId);
  const getPath = useConversationStore((s) => s.getPath);

  // `nodes` isn't read directly here, but it must stay a dependency so this
  // recomputes on every streamed token (getPath reads live store state).
  const path = useMemo(
    () => (activeNodeId ? getPath(activeNodeId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeNodeId, nodes, getPath],
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

  return { rootId, path, siblingsOf };
}
