"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type NodeStatus = "streaming" | "done" | "error";

export interface ConversationNode {
  id: string;
  parentId: string | null;
  role: "user" | "assistant";
  content: string;
  model?: string;
  status: NodeStatus;
  createdAt: number;
  /**
   * Set on a merge node: the ids of the other branch tips folded into it
   * (in addition to `parentId`, its primary/continuing branch). Purely
   * additive metadata — `parentId` still defines the tree structure and
   * `getPath`, so a merge node's own content carries the other branches'
   * context as text (see `mergeBranches`).
   */
  mergedFromIds?: string[];
}

interface ConversationState {
  nodes: Record<string, ConversationNode>;
  rootId: string | null;
  activeNodeId: string | null;
  pendingQuote: string | null;
  addUserNode: (parentId: string | null, content: string) => string;
  addAssistantNode: (parentId: string, model: string) => string;
  appendToNode: (id: string, delta: string) => void;
  setNodeStatus: (id: string, status: NodeStatus) => void;
  setActiveNode: (id: string) => void;
  branchFrom: (nodeId: string, quote?: string) => void;
  focusBranch: (nodeId: string) => void;
  mergeBranches: (nodeIds: string[]) => string;
  removeNode: (id: string) => void;
  clearPendingQuote: () => void;
  reset: () => void;
  getPath: (nodeId: string) => ConversationNode[];
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/**
 * Writing the whole tree to localStorage on every streamed token (dozens of
 * times/sec) is what made streaming feel laggy. Debounce the disk write;
 * in-memory state (and re-renders) stay fully synchronous.
 */
function createDebouncedStorage(): StateStorage {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return {
    getItem: (name) => (typeof window === "undefined" ? null : window.localStorage.getItem(name)),
    setItem: (name, value) => {
      if (typeof window === "undefined") return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => window.localStorage.setItem(name, value), 400);
    },
    removeItem: (name) => {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(name);
    },
  };
}

function latestLeafId(nodes: Record<string, ConversationNode>, id: string): string {
  let cursor = nodes[id];
  if (!cursor) return id;
  for (;;) {
    const children = Object.values(nodes).filter((n) => n.parentId === cursor.id);
    if (children.length === 0) return cursor.id;
    children.sort((a, b) => a.createdAt - b.createdAt);
    cursor = children[children.length - 1];
  }
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      nodes: {},
      rootId: null,
      activeNodeId: null,
      pendingQuote: null,

      addUserNode: (parentId, content) => {
        const id = makeId();
        const node: ConversationNode = {
          id,
          parentId,
          role: "user",
          content,
          status: "done",
          createdAt: Date.now(),
        };
        set((state) => ({
          nodes: { ...state.nodes, [id]: node },
          rootId: state.rootId ?? id,
          activeNodeId: id,
        }));
        return id;
      },

      addAssistantNode: (parentId, model) => {
        const id = makeId();
        const node: ConversationNode = {
          id,
          parentId,
          role: "assistant",
          content: "",
          model,
          status: "streaming",
          createdAt: Date.now(),
        };
        set((state) => ({
          nodes: { ...state.nodes, [id]: node },
          activeNodeId: id,
        }));
        return id;
      },

      appendToNode: (id, delta) => {
        set((state) => {
          const existing = state.nodes[id];
          if (!existing) return state;
          return {
            nodes: {
              ...state.nodes,
              [id]: { ...existing, content: existing.content + delta },
            },
          };
        });
      },

      setNodeStatus: (id, status) => {
        set((state) => {
          const existing = state.nodes[id];
          if (!existing) return state;
          return { nodes: { ...state.nodes, [id]: { ...existing, status } } };
        });
      },

      setActiveNode: (id) => set({ activeNodeId: id }),

      branchFrom: (nodeId, quote) => set({ activeNodeId: nodeId, pendingQuote: quote ?? null }),

      focusBranch: (nodeId) => {
        const { nodes } = get();
        set({ activeNodeId: latestLeafId(nodes, nodeId) });
      },

      mergeBranches: (nodeIds) => {
        const { nodes, getPath } = get();
        const [primaryId, ...otherIds] = nodeIds;
        const primaryPath = getPath(primaryId);

        const sections = otherIds.map((otherId, i) => {
          const otherPath = getPath(otherId);
          let divergeAt = 0;
          while (
            divergeAt < otherPath.length &&
            divergeAt < primaryPath.length &&
            otherPath[divergeAt].id === primaryPath[divergeAt].id
          ) {
            divergeAt++;
          }
          const unique = otherPath.slice(divergeAt);
          const transcript = unique.length
            ? unique
                .map((n) => `${n.role === "user" ? "User" : "Assistant"}: ${n.content}`)
                .join("\n\n")
            : "(no additional messages beyond the shared history)";
          return `Branch ${i + 2}:\n${transcript}`;
        });

        const content = `Merging in context from ${otherIds.length} other branch${
          otherIds.length > 1 ? "es" : ""
        }:\n\n${sections.join("\n\n")}\n\n---\nPlease take all of the above into account going forward.`;

        const id = makeId();
        const node: ConversationNode = {
          id,
          parentId: primaryId,
          role: "user",
          content,
          status: "done",
          createdAt: Date.now(),
          mergedFromIds: otherIds,
        };
        set({ nodes: { ...nodes, [id]: node }, activeNodeId: id });
        return id;
      },

      removeNode: (id) => {
        const { nodes, rootId, activeNodeId } = get();
        const target = nodes[id];
        if (!target) return;

        // Cascade: deleting a node deletes its whole subtree (that branch's
        // entire continuation), not just the one message.
        const toRemove = new Set<string>();
        const stack = [id];
        while (stack.length) {
          const cur = stack.pop()!;
          if (toRemove.has(cur)) continue;
          toRemove.add(cur);
          for (const n of Object.values(nodes)) {
            if (n.parentId === cur) stack.push(n.id);
          }
        }

        const remainingNodes: Record<string, ConversationNode> = {};
        for (const [nodeId, node] of Object.entries(nodes)) {
          if (toRemove.has(nodeId)) continue;
          if (node.mergedFromIds?.some((mid) => toRemove.has(mid))) {
            const mergedFromIds = node.mergedFromIds.filter((mid) => !toRemove.has(mid));
            remainingNodes[nodeId] = mergedFromIds.length
              ? { ...node, mergedFromIds }
              : { ...node, mergedFromIds: undefined };
          } else {
            remainingNodes[nodeId] = node;
          }
        }

        const newRootId = rootId && toRemove.has(rootId) ? null : rootId;
        // Anything still pointing inside the deleted subtree (the deleted
        // node itself, or activeNodeId if it was one of its descendants)
        // falls back to the deleted node's own parent, which is guaranteed
        // to still exist since it sits outside the subtree being removed.
        const newActiveNodeId =
          activeNodeId && toRemove.has(activeNodeId) ? target.parentId : activeNodeId;

        set({ nodes: remainingNodes, rootId: newRootId, activeNodeId: newActiveNodeId });
      },

      clearPendingQuote: () => set({ pendingQuote: null }),

      reset: () => set({ nodes: {}, rootId: null, activeNodeId: null, pendingQuote: null }),

      getPath: (nodeId) => {
        const { nodes } = get();
        const path: ConversationNode[] = [];
        let cursor: string | null = nodeId;
        while (cursor) {
          const node: ConversationNode | undefined = nodes[cursor];
          if (!node) break;
          path.unshift(node);
          cursor = node.parentId;
        }
        return path;
      },
    }),
    {
      name: "bettergpt-conversation",
      storage: createJSONStorage(() => createDebouncedStorage()),
    },
  ),
);
