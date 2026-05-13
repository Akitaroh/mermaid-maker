/**
 * Atom-XyflowMounter
 *
 * 任意の HTMLElement に React + xyflow キャンバスをマウントする Adapter Atom。
 * Stage 3a 段階では read-only（ノード位置の表示のみ）。Stage 3b 以降で
 * onGraphChange を生やす。
 *
 * 設計判断:
 * - controlled state は呼び出し側（Arrow）が持ち、Mount は表示専用に徹する
 * - ノードラベルは renderLabel コールバックを inject（Stage 2b の MarkdownRenderer 再利用予定）
 * - ReactDOM.createRoot で root を作り、unmount は呼び出し側が責任
 */

import { createRoot, Root } from 'react-dom/client';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export type MountOptions = {
  nodes: RFNode[];
  edges: RFEdge[];
  /** dark/light に応じて React Flow の色合いを切り替え */
  theme?: 'light' | 'dark';
  /** ノードラベル描画。指定があれば custom node の中で呼ぶ */
  renderLabel?: (label: string, el: HTMLElement) => void;
};

export type MountHandle = {
  unmount: () => void;
  /** 外部から graph state を強制差替（書き戻し競合時の同期用 / Stage 3b 以降） */
  update: (next: { nodes: RFNode[]; edges: RFEdge[] }) => void;
};

export function mountXyflow(parent: HTMLElement, options: MountOptions): MountHandle {
  // Obsidian の code block container は CodeMirror embed widget 内で寸法が
  // 0 に潰されることがあるため、内側に block 化した wrapper を新設して
  // xyflow にはその wrapper を渡す。固定 px で書く（% は親に依存して 0 になる）。
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

  const render = () => {
    root.render(
      <ReactFlow
        nodes={currentNodes}
        edges={currentEdges}
        onNodesChange={() => { /* read-only */ }}
        onEdgesChange={() => { /* read-only */ }}
        fitView
        fitViewOptions={{ padding: 0.2, includeHiddenNodes: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        colorMode={options.theme === 'dark' ? 'dark' : 'light'}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>,
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
