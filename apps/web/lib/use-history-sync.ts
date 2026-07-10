"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useConversationStore, type Conversation } from "./conversation-store";

export interface HistoryItem {
  id: string;
  title: string;
  updatedAt: number;
  /** Already loaded into the local store, vs. only known from the backend's list. */
  isLocal: boolean;
}

interface RemoteMeta {
  id: string;
  title: string;
  updatedAt: number;
}

/**
 * Syncs conversation history with the Cloudflare Worker backend: fetches
 * the user's conversation list on mount, autosaves the current conversation
 * on meaningful changes, and lazily loads a conversation's full node tree
 * the first time it's opened from a device that doesn't have it locally.
 */
export function useHistorySync() {
  const order = useConversationStore((s) => s.order);
  const conversations = useConversationStore((s) => s.conversations);
  const currentId = useConversationStore((s) => s.currentId);
  const hydrateConversation = useConversationStore((s) => s.hydrateConversation);

  const [remoteMeta, setRemoteMeta] = useState<RemoteMeta[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history")
      .then((res) => (res.ok ? (res.json() as Promise<RemoteMeta[]>) : []))
      .then((list) => {
        if (!cancelled) setRemoteMeta(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const current = currentId ? conversations[currentId] : null;
  const currentUpdatedAt = current?.updatedAt;
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!current || !current.rootId) return;
    const snapshot = current;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch(`/api/history/${snapshot.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: snapshot.title,
          data: {
            nodes: snapshot.nodes,
            rootId: snapshot.rootId,
            activeNodeId: snapshot.activeNodeId,
          },
        }),
      })
        .then((res) => (res.ok ? (res.json() as Promise<RemoteMeta>) : null))
        .then((saved) => {
          if (!saved) return;
          setRemoteMeta((prev) => [saved, ...prev.filter((m) => m.id !== saved.id)]);
        })
        .catch(() => {});
    }, 800);
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
    // Only a new turn starting/finishing (or the tree being edited) bumps
    // `updatedAt` — streamed tokens don't — so this intentionally only
    // depends on id/updatedAt, not the full `current` object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, currentUpdatedAt]);

  const items: HistoryItem[] = useMemo(() => {
    const localIds = new Set(order);
    const local: HistoryItem[] = order
      .map((id) => conversations[id])
      .filter((c): c is Conversation => Boolean(c) && Boolean(c.rootId))
      .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, isLocal: true }));
    const remoteOnly: HistoryItem[] = remoteMeta
      .filter((m) => !localIds.has(m.id))
      .map((m) => ({ ...m, isLocal: false }));
    return [...local, ...remoteOnly].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [order, conversations, remoteMeta]);

  async function load(id: string): Promise<boolean> {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/history/${id}`);
      if (!res.ok) return false;
      const remote = await res.json();
      hydrateConversation({
        id: remote.id,
        title: remote.title,
        updatedAt: remote.updatedAt,
        nodes: remote.data.nodes,
        rootId: remote.data.rootId,
        activeNodeId: remote.data.activeNodeId,
      });
      return true;
    } catch {
      return false;
    } finally {
      setLoadingId(null);
    }
  }

  function remove(id: string) {
    setRemoteMeta((prev) => prev.filter((m) => m.id !== id));
    fetch(`/api/history/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return { items, loadingId, load, remove };
}
