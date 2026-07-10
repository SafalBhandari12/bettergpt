"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useConversationStore } from "@/lib/conversation-store";
import { useConversationTree } from "@/lib/use-conversation-tree";
import { layoutTree, NODE_WIDTH, NODE_HEIGHT } from "@/lib/tree-layout";
import { CloseIcon } from "@/components/icons";

interface DragState {
  fromId: string;
  x: number;
  y: number;
  overId: string | null;
}

export function BranchGraph() {
  const nodes = useConversationStore((s) => s.nodes);
  const rootId = useConversationStore((s) => s.rootId);
  const activeNodeId = useConversationStore((s) => s.activeNodeId);
  const focusBranch = useConversationStore((s) => s.focusBranch);
  const mergeBranches = useConversationStore((s) => s.mergeBranches);
  const removeNode = useConversationStore((s) => s.removeNode);
  const { path } = useConversationTree();

  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const activePathIds = useMemo(() => new Set(path.map((n) => n.id)), [path]);
  const { graphNodes, edges, width, height } = useMemo(
    () => layoutTree(nodes, rootId),
    [nodes, rootId],
  );

  useEffect(() => {
    if (!drag) return;
    const fromId = drag.fromId;

    function toLocal(clientX: number, clientY: number) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function nodeAt(x: number, y: number, excludeId: string) {
      return graphNodes.find(
        (n) =>
          n.id !== excludeId &&
          x >= n.x &&
          x <= n.x + NODE_WIDTH &&
          y >= n.y &&
          y <= n.y + NODE_HEIGHT,
      );
    }

    function onMove(e: MouseEvent) {
      const { x, y } = toLocal(e.clientX, e.clientY);
      setDrag((prev) => {
        if (!prev) return prev;
        const target = nodeAt(x, y, prev.fromId);
        return { ...prev, x, y, overId: target?.id ?? null };
      });
    }

    function onUp(e: MouseEvent) {
      const { x, y } = toLocal(e.clientX, e.clientY);
      const target = nodeAt(x, y, fromId);
      if (target) mergeBranches([fromId, target.id]);
      setDrag(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // Only re-attach when a drag starts/ends — graphNodes/mergeBranches from
    // this closure are the values current when the drag began, which is
    // what we want (nothing else changes mid-drag).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.fromId]);

  if (!rootId) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-zinc-400">
        Start a conversation in Chat first — the branch map will show up here.
      </div>
    );
  }

  const byId = new Map(graphNodes.map((n) => [n.id, n]));

  function handleRemove(id: string) {
    const hasChildren = Object.values(nodes).some((n) => n.parentId === id);
    const message = hasChildren
      ? "Delete this message and everything after it in this branch?"
      : "Delete this message?";
    if (!window.confirm(message)) return;
    removeNode(id);
  }

  function startConnect(e: React.MouseEvent, fromId: string) {
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : 0;
    const y = rect ? e.clientY - rect.top : 0;
    setDrag({ fromId, x, y, overId: null });
  }

  const dragFromNode = drag ? byId.get(drag.fromId) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 justify-center overflow-auto p-8">
        <div ref={containerRef} className="relative shrink-0" style={{ width, height }}>
          <svg
            className="pointer-events-none absolute inset-0 overflow-visible"
            width={width}
            height={height}
          >
            {edges.map((edge) => {
              const source = byId.get(edge.source);
              const target = byId.get(edge.target);
              if (!source || !target) return null;
              const onActivePath =
                activePathIds.has(edge.source) && activePathIds.has(edge.target);

              if (edge.kind === "merge") {
                const x1 = source.x + NODE_WIDTH;
                const y1 = source.y + NODE_HEIGHT / 2;
                const x2 = target.x;
                const y2 = target.y + NODE_HEIGHT / 2;
                return (
                  <path
                    key={edge.id}
                    d={`M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    className="stroke-violet-500 dark:stroke-violet-400"
                  />
                );
              }

              const x1 = source.x + NODE_WIDTH / 2;
              const y1 = source.y + NODE_HEIGHT;
              const x2 = target.x + NODE_WIDTH / 2;
              const y2 = target.y;
              const midY = (y1 + y2) / 2;
              return (
                <path
                  key={edge.id}
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  fill="none"
                  strokeWidth={onActivePath ? 2 : 1.5}
                  className={
                    onActivePath
                      ? "stroke-emerald-500 dark:stroke-emerald-400"
                      : "stroke-zinc-300 dark:stroke-zinc-700"
                  }
                />
              );
            })}

            {drag && dragFromNode && (
              <path
                d={`M ${dragFromNode.x + NODE_WIDTH} ${dragFromNode.y + NODE_HEIGHT / 2} L ${drag.x} ${drag.y}`}
                fill="none"
                strokeWidth={2}
                strokeDasharray="5 4"
                className="stroke-violet-500 dark:stroke-violet-400"
              />
            )}
          </svg>

          {graphNodes.map((n) => {
            const isUser = n.message.role === "user";
            const isActiveLeaf = n.id === activeNodeId;
            const onActivePath = activePathIds.has(n.id);
            const isMerged = (n.message.mergedFromIds?.length ?? 0) > 0;
            const isDropTarget = drag?.overId === n.id;

            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => focusBranch(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    focusBranch(n.id);
                  }
                }}
                title={n.message.content || undefined}
                style={{ left: n.x, top: n.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                className={`absolute flex cursor-pointer flex-col gap-1 rounded-xl border px-3 py-2 text-left shadow-sm transition-colors ${
                  isDropTarget
                    ? "border-violet-600 bg-violet-50 ring-2 ring-violet-600/40 dark:border-violet-400 dark:bg-violet-500/10"
                    : isActiveLeaf
                      ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/30 dark:border-emerald-400 dark:bg-emerald-500/10"
                      : onActivePath
                        ? "border-emerald-300 bg-white dark:border-emerald-700 dark:bg-zinc-900"
                        : "border-black/[.08] bg-white hover:border-black/20 dark:border-white/[.145] dark:bg-zinc-900 dark:hover:border-white/30"
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(n.id);
                  }}
                  aria-label="Delete this message"
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-black/[.08] bg-white text-zinc-400 shadow-sm hover:border-red-300 hover:text-red-600 dark:border-white/[.145] dark:bg-zinc-900 dark:hover:border-red-800 dark:hover:text-red-400"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>

                <span className="flex items-center gap-1">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide ${
                      isUser ? "text-zinc-400" : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {isUser ? "You" : (n.message.model ?? "Assistant")}
                  </span>
                  {isMerged && (
                    <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                      Merged
                    </span>
                  )}
                </span>
                <span className="line-clamp-3 text-xs leading-4 text-zinc-700 dark:text-zinc-300">
                  {n.message.content || "…"}
                </span>

                <button
                  onMouseDown={(e) => startConnect(e, n.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Drag to connect this branch to another"
                  title="Drag to another node to merge branches"
                  className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-violet-500 shadow hover:bg-violet-600 dark:border-zinc-900"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
