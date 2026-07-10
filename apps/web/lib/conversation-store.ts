"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type NodeStatus = "streaming" | "done" | "error";

/**
 * One conversational turn: the user's prompt and the model's response live on
 * the same node. Branching, merging, and the tree layout all operate on
 * turns, not on separate user/assistant messages — a turn is the smallest
 * unit you can fork from or delete.
 */
export interface ConversationNode {
  id: string;
  parentId: string | null;
  prompt: string;
  response: string;
  model?: string;
  status: NodeStatus;
  createdAt: number;
  /**
   * Set on a merge node: the ids of the other branch tips folded into it
   * (in addition to `parentId`, its primary/continuing branch). Purely
   * additive metadata — `parentId` still defines the tree structure and
   * `getPath`, so a merge node's own prompt carries the other branches'
   * context as text (see `mergeBranches`).
   */
  mergedFromIds?: string[];
}

export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  nodes: Record<string, ConversationNode>;
  rootId: string | null;
  activeNodeId: string | null;
}

interface ConversationState {
  conversations: Record<string, Conversation>;
  /** Conversation ids, most-recently-updated first. */
  order: string[];
  currentId: string | null;
  pendingQuote: string | null;

  newConversation: () => string;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  /** Upserts a full conversation, e.g. after loading one from the backend. */
  hydrateConversation: (conversation: Conversation) => void;

  addTurn: (parentId: string | null, prompt: string, model: string) => string;
  appendResponse: (id: string, delta: string) => void;
  setNodeStatus: (id: string, status: NodeStatus) => void;
  setActiveNode: (id: string) => void;
  branchFrom: (nodeId: string, quote?: string) => void;
  focusBranch: (nodeId: string) => void;
  mergeBranches: (nodeIds: string[]) => string;
  removeNode: (id: string) => void;
  clearPendingQuote: () => void;
  getPath: (nodeId: string) => ConversationNode[];
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function titleFromPrompt(prompt: string): string {
  const oneLine = prompt.trim().split("\n")[0] ?? "";
  return oneLine.length > 48 ? `${oneLine.slice(0, 48)}…` : oneLine || "New chat";
}

function emptyConversation(id: string): Conversation {
  return {
    id,
    title: "New chat",
    updatedAt: Date.now(),
    nodes: {},
    rootId: null,
    activeNodeId: null,
  };
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

/** Moves `id` to the front of `order`, inserting it if it isn't already there. */
function bumpOrder(order: string[], id: string): string[] {
  return [id, ...order.filter((existing) => existing !== id)];
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversations: {},
      order: [],
      currentId: null,
      pendingQuote: null,

      newConversation: () => {
        const id = makeId();
        const conversation = emptyConversation(id);
        set((state) => ({
          conversations: { ...state.conversations, [id]: conversation },
          order: bumpOrder(state.order, id),
          currentId: id,
          pendingQuote: null,
        }));
        return id;
      },

      switchConversation: (id) => {
        if (!get().conversations[id]) return;
        set({ currentId: id, pendingQuote: null });
      },

      deleteConversation: (id) => {
        const { conversations, order, currentId } = get();
        if (!conversations[id]) return;
        const remaining = { ...conversations };
        delete remaining[id];
        const remainingOrder = order.filter((existing) => existing !== id);
        const nextCurrentId = currentId === id ? (remainingOrder[0] ?? null) : currentId;
        set({
          conversations: remaining,
          order: remainingOrder,
          currentId: nextCurrentId,
        });
      },

      hydrateConversation: (conversation) => {
        set((state) => ({
          conversations: { ...state.conversations, [conversation.id]: conversation },
          order: bumpOrder(state.order, conversation.id),
        }));
      },

      addTurn: (parentId, prompt, model) => {
        const { currentId, conversations } = get();
        if (!currentId) return "";
        const conversation = conversations[currentId];
        if (!conversation) return "";

        const id = makeId();
        const node: ConversationNode = {
          id,
          parentId,
          prompt,
          response: "",
          model,
          status: "streaming",
          createdAt: Date.now(),
        };
        const isFirstTurn = conversation.rootId === null;
        const updated: Conversation = {
          ...conversation,
          nodes: { ...conversation.nodes, [id]: node },
          rootId: conversation.rootId ?? id,
          activeNodeId: id,
          title: isFirstTurn ? titleFromPrompt(prompt) : conversation.title,
          updatedAt: Date.now(),
        };
        set((state) => ({
          conversations: { ...state.conversations, [currentId]: updated },
          order: bumpOrder(state.order, currentId),
        }));
        return id;
      },

      appendResponse: (id, delta) => {
        const { currentId, conversations } = get();
        if (!currentId) return;
        const conversation = conversations[currentId];
        const existing = conversation?.nodes[id];
        if (!conversation || !existing) return;
        set((state) => ({
          conversations: {
            ...state.conversations,
            [currentId]: {
              ...conversation,
              nodes: {
                ...conversation.nodes,
                [id]: { ...existing, response: existing.response + delta },
              },
            },
          },
        }));
      },

      setNodeStatus: (id, status) => {
        const { currentId, conversations } = get();
        if (!currentId) return;
        const conversation = conversations[currentId];
        const existing = conversation?.nodes[id];
        if (!conversation || !existing) return;
        set((state) => ({
          conversations: {
            ...state.conversations,
            [currentId]: {
              ...conversation,
              nodes: { ...conversation.nodes, [id]: { ...existing, status } },
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setActiveNode: (id) => {
        const { currentId, conversations } = get();
        if (!currentId || !conversations[currentId]) return;
        set((state) => ({
          conversations: {
            ...state.conversations,
            [currentId]: { ...conversations[currentId], activeNodeId: id },
          },
        }));
      },

      branchFrom: (nodeId, quote) => {
        get().setActiveNode(nodeId);
        set({ pendingQuote: quote ?? null });
      },

      focusBranch: (nodeId) => {
        const { currentId, conversations } = get();
        if (!currentId) return;
        const conversation = conversations[currentId];
        if (!conversation) return;
        get().setActiveNode(latestLeafId(conversation.nodes, nodeId));
      },

      mergeBranches: (nodeIds) => {
        const { currentId, conversations, getPath } = get();
        if (!currentId) return "";
        const conversation = conversations[currentId];
        if (!conversation) return "";

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
            ? unique.map((n) => `User: ${n.prompt}\n\nAssistant: ${n.response}`).join("\n\n")
            : "(no additional messages beyond the shared history)";
          return `Branch ${i + 2}:\n${transcript}`;
        });

        const prompt = `Merging in context from ${otherIds.length} other branch${
          otherIds.length > 1 ? "es" : ""
        }:\n\n${sections.join("\n\n")}\n\n---\nPlease take all of the above into account going forward.`;

        const id = makeId();
        const node: ConversationNode = {
          id,
          parentId: primaryId,
          prompt,
          response: "",
          status: "done",
          createdAt: Date.now(),
          mergedFromIds: otherIds,
        };
        set((state) => ({
          conversations: {
            ...state.conversations,
            [currentId]: {
              ...conversation,
              nodes: { ...conversation.nodes, [id]: node },
              activeNodeId: id,
              updatedAt: Date.now(),
            },
          },
        }));
        return id;
      },

      removeNode: (id) => {
        const { currentId, conversations } = get();
        if (!currentId) return;
        const conversation = conversations[currentId];
        const target = conversation?.nodes[id];
        if (!conversation || !target) return;

        // Cascade: deleting a node deletes its whole subtree (that branch's
        // entire continuation), not just the one turn.
        const toRemove = new Set<string>();
        const stack = [id];
        while (stack.length) {
          const cur = stack.pop()!;
          if (toRemove.has(cur)) continue;
          toRemove.add(cur);
          for (const n of Object.values(conversation.nodes)) {
            if (n.parentId === cur) stack.push(n.id);
          }
        }

        const remainingNodes: Record<string, ConversationNode> = {};
        for (const [nodeId, node] of Object.entries(conversation.nodes)) {
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

        const newRootId =
          conversation.rootId && toRemove.has(conversation.rootId) ? null : conversation.rootId;
        // Anything still pointing inside the deleted subtree (the deleted
        // node itself, or activeNodeId if it was one of its descendants)
        // falls back to the deleted node's own parent, which is guaranteed
        // to still exist since it sits outside the subtree being removed.
        const newActiveNodeId =
          conversation.activeNodeId && toRemove.has(conversation.activeNodeId)
            ? target.parentId
            : conversation.activeNodeId;

        set((state) => ({
          conversations: {
            ...state.conversations,
            [currentId]: {
              ...conversation,
              nodes: remainingNodes,
              rootId: newRootId,
              activeNodeId: newActiveNodeId,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      clearPendingQuote: () => set({ pendingQuote: null }),

      getPath: (nodeId) => {
        const { currentId, conversations } = get();
        const conversation = currentId ? conversations[currentId] : undefined;
        if (!conversation) return [];
        const path: ConversationNode[] = [];
        let cursor: string | null = nodeId;
        while (cursor) {
          const node: ConversationNode | undefined = conversation.nodes[cursor];
          if (!node) break;
          path.unshift(node);
          cursor = node.parentId;
        }
        return path;
      },
    }),
    {
      name: "bettergpt-conversations-v2",
      storage: createJSONStorage(() => createDebouncedStorage()),
    },
  ),
);
