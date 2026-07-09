import type { ConversationNode } from "./conversation-store";

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 92;
const H_GAP = 28;
const V_GAP = 64;

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  message: ConversationNode;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  /** "parent" edges always run top-to-bottom by construction (child depth =
   * parent depth + 1); "merge" edges connect a merge node to the other
   * branch tips folded into it, which can sit anywhere in the tree. */
  kind: "parent" | "merge";
}

export interface GraphLayout {
  graphNodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

/**
 * Hand-rolled tree layout (no d3/canvas library) — this only renders in the
 * Branches tab, never while a response is streaming, so it doesn't need to
 * be canvas-cheap on every token like the old React Flow view did.
 * Leftmost-leaf placement: each leaf gets the next free column, each parent
 * centers over its children's columns.
 */
export function layoutTree(
  nodes: Record<string, ConversationNode>,
  rootId: string | null,
): GraphLayout {
  if (!rootId || !nodes[rootId]) {
    return { graphNodes: [], edges: [], width: 0, height: 0 };
  }

  const childrenOf = new Map<string, ConversationNode[]>();
  for (const node of Object.values(nodes)) {
    if (node.parentId === null) continue;
    const siblings = childrenOf.get(node.parentId);
    if (siblings) siblings.push(node);
    else childrenOf.set(node.parentId, [node]);
  }
  for (const siblings of childrenOf.values()) {
    siblings.sort((a, b) => a.createdAt - b.createdAt);
  }

  const graphNodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let nextColumn = 0;
  let maxDepth = 0;

  function place(id: string, depth: number): number {
    maxDepth = Math.max(maxDepth, depth);
    const children = childrenOf.get(id) ?? [];
    let centerPx: number;

    if (children.length === 0) {
      const column = nextColumn++;
      centerPx = (column + 0.5) * (NODE_WIDTH + H_GAP);
    } else {
      const childCenters = children.map((child) => {
        edges.push({ id: `${id}-${child.id}`, source: id, target: child.id, kind: "parent" });
        return place(child.id, depth + 1);
      });
      centerPx = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
    }

    graphNodes.push({
      id,
      x: centerPx - NODE_WIDTH / 2,
      y: depth * (NODE_HEIGHT + V_GAP),
      message: nodes[id],
    });
    return centerPx;
  }

  place(rootId, 0);

  for (const node of Object.values(nodes)) {
    for (const sourceId of node.mergedFromIds ?? []) {
      edges.push({ id: `merge-${sourceId}-${node.id}`, source: sourceId, target: node.id, kind: "merge" });
    }
  }

  return {
    graphNodes,
    edges,
    width: Math.max(nextColumn * (NODE_WIDTH + H_GAP), NODE_WIDTH),
    height: (maxDepth + 1) * (NODE_HEIGHT + V_GAP),
  };
}
