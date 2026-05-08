/**
 * Atom-Layout
 * 座標未指定の Graph に dagre で初期座標を割り当て
 * 設計: ../../../50_Mission/Mermaid Maker/Atom-Layout.md
 */

import dagre from 'dagre';
import type { Graph as InternalGraph, PositionMap } from '../types/schema';

export type LayoutOptions = {
  direction?: 'LR' | 'TD';
  nodeSpacing?: number;
  rankSpacing?: number;
};

const DEFAULT_NODE_WIDTH = 80;
const DEFAULT_NODE_HEIGHT = 60;

export function fillMissingPositions(
  graph: InternalGraph,
  existing: PositionMap,
  options: LayoutOptions = {},
): PositionMap {
  if (graph.nodes.length === 0) return {};

  const direction = options.direction ?? graph.direction;
  const nodeSpacing = options.nodeSpacing ?? 100;
  const rankSpacing = options.rankSpacing ?? 150;

  const dg = new dagre.graphlib.Graph();
  dg.setGraph({
    rankdir: direction === 'LR' ? 'LR' : 'TB',
    nodesep: nodeSpacing,
    ranksep: rankSpacing,
  });
  dg.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    dg.setNode(node.id, {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    });
  }

  // 自己ループは dagre に渡さない
  for (const edge of graph.edges) {
    if (edge.source !== edge.target) {
      dg.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(dg);

  const result: PositionMap = {};
  for (const node of graph.nodes) {
    const dn = dg.node(node.id);
    if (dn && Number.isFinite(dn.x) && Number.isFinite(dn.y)) {
      result[node.id] = { x: dn.x, y: dn.y };
    } else {
      // dagre が返さなかったノード（自己ループのみ等）に対する fallback
      result[node.id] = { x: 0, y: 0 };
    }
  }

  // 既存座標で上書き
  for (const id of Object.keys(existing)) {
    result[id] = existing[id];
  }

  return result;
}
