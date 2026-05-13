/**
 * Atom-XyflowMounter
 *
 * 任意の HTMLElement に React + xyflow キャンバスをマウントする Adapter Atom。
 *
 * Stage 3a: read-only でノード/エッジ表示
 * Stage 3b: ノードドラッグを有効化、ドラッグ完了時に**全ノード**位置を通知
 *
 * 設計判断:
 * - controlled state 化を避け、xyflow にノード state を任せる
 *   （v12 で controlled + applyNodeChanges を使うと measured が伝播せず
 *    edge が描画されないケースがあるため）
 * - 位置変更は onNodeDragStop で「ドラッグ完了時」だけ拾う
 * - 第 3 引数 (drag された nodes) では他のノード位置が落ちるので、
 *   ReactFlowProvider + useReactFlow().getNodes() で全 nodes を取得する
 */

import { createRoot, Root } from 'react-dom/client';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  type Node as RFNode,
  type Edge as RFEdge,
} from '@xyflow/react';
import type { PositionMap } from '@akitaroh/mermaid-core';
import '@xyflow/react/dist/style.css';

export type MountOptions = {
  nodes: RFNode[];
  edges: RFEdge[];
  theme?: 'light' | 'dark';
  /** Stage 3b: ドラッグ完了時に最新 positions を通知 */
  onPositionsChange?: (positions: PositionMap) => void;
};

export type MountHandle = {
  unmount: () => void;
  update: (next: { nodes: RFNode[]; edges: RFEdge[] }) => void;
};

function extractPositions(nodes: RFNode[]): PositionMap {
  const map: PositionMap = {};
  for (const n of nodes) {
    map[n.id] = { x: n.position.x, y: n.position.y };
  }
  return map;
}

type InnerProps = {
  nodes: RFNode[];
  edges: RFEdge[];
  theme: 'light' | 'dark';
  draggable: boolean;
  onPositionsChange?: (positions: PositionMap) => void;
};

function CanvasInner({
  nodes,
  edges,
  theme,
  draggable,
  onPositionsChange,
}: InnerProps) {
  const { getNodes } = useReactFlow();
  return (
    <ReactFlow
      defaultNodes={nodes}
      defaultEdges={edges}
      fitView
      fitViewOptions={{ padding: 0.2, includeHiddenNodes: true }}
      nodesDraggable={draggable}
      nodesConnectable={false}
      elementsSelectable={draggable}
      colorMode={theme}
      proOptions={{ hideAttribution: true }}
      onNodeDragStop={() => {
        // getNodes() は xyflow internal store から「全ノード」を取得する
        // 第 3 引数の nodes[] は drag されたものだけなので落とせない
        onPositionsChange?.(extractPositions(getNodes()));
      }}
    >
      <Background gap={16} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function mountXyflow(parent: HTMLElement, options: MountOptions): MountHandle {
  parent.empty();
  const wrapper = parent.createDiv();
  wrapper.style.cssText = [
    'display: block',
    'box-sizing: border-box',
    'height: 420px',
    'width: 100%',
    'min-width: 320px',
    'border: 1px solid var(--background-modifier-border)',
    'border-radius: 6px',
    'overflow: hidden',
    'position: relative',
  ].join(';');

  const root: Root = createRoot(wrapper);

  let currentNodes = options.nodes;
  let currentEdges = options.edges;
  const draggable = !!options.onPositionsChange;

  const render = () => {
    root.render(
      <ReactFlowProvider>
        <CanvasInner
          nodes={currentNodes}
          edges={currentEdges}
          theme={options.theme === 'dark' ? 'dark' : 'light'}
          draggable={draggable}
          onPositionsChange={options.onPositionsChange}
        />
      </ReactFlowProvider>,
    );
  };

  render();

  return {
    unmount: () => {
      root.unmount();
    },
    update: (next) => {
      currentNodes = next.nodes;
      currentEdges = next.edges;
      render();
    },
  };
}
